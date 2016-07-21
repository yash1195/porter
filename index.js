var PorterRecord	= require('./porterdb');
var shortid			= require('shortid');
var Q		  		= require('q');
var http 	  		= require('http');
var logFlag			= true; // porter should log or not
var _				= require('lodash');
var knox			= require('knox');

module.exports = {
	addAsset: addAssetAction,
	getAsset: getAssetAction,
	logs	: logsAction
}

function logsAction(flag){
	if(flag === false){
		logFlag = false;
	}
}

function porterLog(log){
	if(logFlag){
		var prefix = "Porter Log : ";
		var line = "--------------------------------------------------------------------------------";
		console.log(line);
		console.log(prefix+log);
		console.log(line);
	}
}


function getAssetAction(token_id){
	return Q.promise(function(resolve,reject){

		var criteria = {
			token_id: token_id
		};

		// Query PorterTable for
		PorterRecord.findOne(criteria,function(err,record){

			var err_obj = {};

			if(err){
				err_obj.status = "-1";
				err_obj.error  = "Failed to retrieve Asset";
				porterLog("Failed to retrieve Asset");
				resolve(err_obj);
			}
			else if(record === null){
				err_obj.status = "0";
				err_obj.error  = "Asset does not exist";
				porterLog("Asset does not exist");
				resolve(err_obj);	
			}
			// add asset
			else{

				var obj = {}; // returning json

				// if resizing and upload to cloud not done
				if( record.is_ported === false ){

					// decorator for local asset
					obj.isResized= false;
					obj.inCloud  = false;
					obj.token_id = record.token_id;
					obj.url      = record.local_url;

					// send json back
					resolve(obj);

				}
				// if resizing and upload to cloud done
				else{
					// decorator for cloud asset
					obj.isResized= true;
					obj.inCloud  = true;
					obj.token_id = record.token_id;
					obj.url      = record.raw_image;
					obj.url_small      = record.raw_image;
					obj.url_medium      = record.raw_image;
					obj.url_thumb      = record.raw_image;							
				}
			}
		});
	});
}

function checkCloud(bucket){
	return Q.promise(function(resolve,reject){
		if(_.isEmpty(bucket)){
			resolve(0);
		}
		else{
			try{
				var client = knox.createClient({
					key: bucket.key,
					secret: bucket.secret,
					bucket: bucket.bucket
				});
				delete client;
				resolve(0);
			}
			catch(e){
				reject(0);
			}
		}
	});
}

function addAssetAction(foo,bucket){
	
	// foo has Skipper Upstream for file
		return Q.promise(function(resolve,reject){

			// check if cloud or local
			var local = false;
			if(bucket === undefined){
				bucket = {};
				local = true;
			}
			else{
				bucket.service = "s3";
			}

			var err_obj = {};

			checkCloud(bucket)
			.then(function(e){
				// upload to Local Storage
				foo.upload(function(err,files){
					if(err){
						err_obj.status = "-1";
						err_obj.error  = "Failed to add Asset";
						porterLog("Error - Asset not added");
						resolve(err_obj);
					}
					else{
						
						var token_id = shortid.generate();

						var asset = new PorterRecord({
							local_url	: files[0].fd,
							token_id	: token_id,
							cloud		: bucket,
							only_local	: local
						});

						asset.save(function(err){
							if(err){
								err_obj.status = "-1";
								err_obj.error  = "Failed to add Asset to PorterTable";
								porterLog("Error - Asset not added to PorterTable");
								resolve(err_obj);
							}
							else{
								porterLog('Asset (Token ID:'+token_id+') added to Local Storage!');
								resolve(token_id);
							}
						});
					}
				});
			})
			.catch(function(e){
				err_obj.status = "-1";
				err_obj.error  = "Bad Cloud";
				porterLog("Error - Bad Cloud");
				resolve(err_obj);
			});

				
		});
}
