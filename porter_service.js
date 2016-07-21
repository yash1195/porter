var util			= require("util");
var http 			= require("http");
var PorterRecord	= require("./porterdb");
var bluebird		= require("bluebird");
var knox			= require("knox");
var fs 				= require('fs');
var mime			= require('mime');
var rimraf 			= require('rimraf');
var Q				= require('q');

function porterDaemonLog(log){
	var prefix = "Porter Log : (Daemon) ";
	var line = "--------------------------------------------------------------------------------";
	console.log(line);
	console.log(prefix+log);
	console.log(line);
}

function updatePorterTable(asset,port_information){

	return Q.promise(function(resolve,reject){
		port_information.is_ported = true;

		PorterRecord.findOneAndUpdate({token_id: asset.token_id},port_information,function(e){
			porterDaemonLog('Asset (Token ID:'+asset.token_id+') ported to cloud');
			// delete file from local storage
			rimraf(asset.local_url,function(err){
				if(err){
					porterDaemonLog('Asset (Token ID:'+asset.token_id+') failed to remove from Local Storage');
					resolve(-1);
				}
				else{
					porterDaemonLog('Asset (Token ID:'+asset.token_id+') removed from Local Storage');
					resolve(1);
				}
			});
		});
	});
}

function uploadAssteToS3(asset){
	return Q.promise(function(resolve,reject){
		// needs to be configured by user
		try{
			var client = knox.createClient({
				key: asset.cloud.key,
				secret: asset.cloud.secret,
				bucket: asset.cloud.bucket
			});	
		}
		catch(e){
			porterDaemonLog("Asset (Token ID:"+asset.token_id+") has bad cloud");
			resolve(0);
		}
		

		var tmp = asset.local_url.split("/");
		var file_name = tmp[tmp.length-1];
		var file_path = asset.local_url;

	    var mimetype = mime.lookup(file_path);

	    client.putFile(file_path, "images/"+file_name,{
			'Content-Type': mimetype,
			'Cache-Control': 'max-age=604800',
			'x-amz-acl': 'public-read'
		},
		function(err, result) {
			console.log('wss');
			if(err){
				porterDaemonLog("Porting of Asset = "+asset.token_id+" failed.");
				resolve(0);
			}
			else{
				// Porting Successful
				var raw_image_url = result.req.url;

				// Update PorterTable
				var port_information = {};
				port_information.raw_image = raw_image_url;
				updatePorterTable(asset,port_information)
				.then(function(status){
					resolve(0);
				});
			}
		});
	});
}


// find all assets that haven't been ported

var criteria = {
	is_ported: false,
	only_local: false
};

//
PorterRecord.find(criteria,function(err,records){
	if(!err && (records.length > 0)){
		var i = 0;
		// need to maintain synchronicty to remove race condition for script run
		records.forEach(function(e){
			uploadAssteToS3(e)
			.then(function(status){
				i = i + 1;
				if(i == records.length){
					process.exit(0);
				}
			});
		});
	}
	else{
		porterDaemonLog("No records available for porting to cloud");
		process.exit(0);
	}
});