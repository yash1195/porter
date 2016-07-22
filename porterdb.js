var mongoose = require('mongoose');

mongoose.connect('mongodb://localhost/porter');

var Schema = mongoose.Schema;

var PorterSchema = new Schema({
	file_name: String,
	local_url: String,
	token_id : String,
	is_ported: {
		type: Boolean,
		default: false
	},
	only_local: {
		type: Boolean,
		default: false
	},
	raw_image: String,
	cloud: Object
});

var PorterTable = mongoose.model('PorterTable', PorterSchema);

module.exports = PorterTable;