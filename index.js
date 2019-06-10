let request = require('request');
require('request').debug = false

let Service, Characteristic;
//let Accessory, hap, UUIDGen;

module.exports = function(homebridge) {

    // Accessory must be created from PlatformAccessory Constructor
    //Accessory = homebridge.platformAccessory;
    //hap = homebridge.hap;
    // Service and Characteristic are from hap-nodejs
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    //UUIDGen = homebridge.hap.uuid;
  
    // For platform plugin to be considered as dynamic platform plugin,
    // registerPlatform(pluginName, platformName, constructor, dynamic), dynamic must be true
    homebridge.registerAccessory("homebridge-boschindego", "BoschIndego", BoschIndego);
}

// Platform constructor
// config may be null
// api may be null if launched from old homebridge version
function BoschIndego(log, config, api) {
  
    this.log = log;
  
    this.name = config["name"];
    this.email = config["email"];
    this.pass = config["pass"];
    this.model = config["model"];
    this.auth = new Buffer(this.email + ":" + this.pass).toString("base64");
    this.update_interval = Number( config["update_interval"] || 1200000 );
	
    this.serial = 1;
    this.userId = 0;
    this.contextId = 0;
	
	this.view_log = config["view_log"];
	this.authed = false;
	
    this.log("BoschIndego Init" + this.serial);
  
}

BoschIndego.prototype = {
    
    updateState: function () {
        //Ensure previous call finished
        if (this.waiting_response) {
			if (this.view_log)
				this.log('Avoid updateState as previous response does not arrived yet');
            return;
        }
        this.waiting_response = true;
        
		if (this.authed == false)
			this.authentication();
        
        let ops = {
            method: 'GET',
            uri: 'https://api.indego.iot.bosch-si.com/api/v1/alms/'+this.serial+'/state',
            headers: {
                'x-im-context-id': ' ' + this.contextId
            },  
            timeout: 3000
        };
        //this.log('Requesting motion on "' + ops.uri + '", method ' + ops.method + ', timeout ' + ops.timeout);
        let value = null;
        request(ops, (error, res, body) => {
            if (error) {
				if (this.view_log)
					this.log('HTTP bad response (' + ops.uri + '): ' + error.message);
            } else if (this.json_response === "") {
                value = body;
                //this.log('HTTP successful response: ' + body);
            } else {
                try {
                    value = JSON.parse(body)[this.json_response];
                    let datatest = JSON.parse(body);
                    value = datatest.state;
                    if (this.view_log)
						this.log('HTTP successful response state code: ' + value);
                } catch (parseErr) {
					if (this.view_log) {
						this.log('Error processing received information: ' + parseErr.message);
						this.log('Error processing received information: ' + res.statusCode);
					}
                    error = parseErr;
					
					//if (res.statusCode == 401)
						this.authed = false
                }
            }
            if (!error) {
                // Properly set the return value
                if (value === 513 || value === 514 || value === 515 || value === 516 || value === 517 || value === 518 || value === 519 || value === 769 || value === 770 || value === 771  || value === 772 || value === 773 || value === 774 || value === 775 || value === 776) value = true;
                else if (value === 257 || value === 258 || value === 259 || value === 260 || value === 261 || value === 262 || value === 263) value = false;

                // Check if return value is valid
                if (value !== true && value !== false) {
					if (this.view_log)
						this.log('Received value is not valid. Keeping last_state: "' + this.last_state + '"');
                } else {
                    this.motionService
                    .getCharacteristic(Characteristic.MotionDetected).updateValue(value, null, "updateState");
                    this.last_state = value;
                }
            }
            this.waiting_response = false;
        });
    },
    
    getState: function (callback) {
      let state = this.last_state;
      let update = !this.waiting_response;
      let sync = this.update_interval === 0;
	  if (this.view_log)
		this.log('Call to getState: last_state is "' + state + '", will update state now "' + update + '"' );
      if (update) {
         setImmediate(this.updateState.bind(this));
      }
      callback(null, state);
   },
    getServices: function () {
        this.informationService = new Service.AccessoryInformation();
        this.informationService
        .setCharacteristic(Characteristic.Manufacturer, "Bosch")
        .setCharacteristic(Characteristic.Model, this.model)
        .setCharacteristic(Characteristic.SerialNumber, this.serial);
        
        this.motionService = new Service.MotionSensor(this.name);
        this.motionService
         .getCharacteristic(Characteristic.MotionDetected)
         .on('get', this.getState.bind(this));
    
        if (this.update_interval > 0) {
            this.timer = setInterval(this.updateState.bind(this), this.update_interval);
        }

        return [this.informationService, this.motionService];
   }
}

BoschIndego.prototype.authentication = function() {
    let body = {
            'device': '',
            'os_type': 'Android',
            'os_version': '4.0',
            'dvc_manuf': 'unknown',
            'dvc_type': 'unknown'
    };

    let ops = {
        method: 'POST',
        uri: 'https://api.indego.iot.bosch-si.com/api/v1/authenticate',
        body: JSON.stringify(body),
        headers: {
            'Authorization': 'Basic ' + this.auth,
            'content-type': 'application/json'
        },  
        timeout: 3000
    };
    
    request(ops, (error, res, body) => {
        let value = null;
        if (error) {
            this.log('HTTP bad response (' + ops.uri + '): ' + error.message);
        } else {
            try {
                value = JSON.parse(body);
				
                this.serial = value.alm_sn;
                this.userId = value.userId;
                this.contextId = value.contextId;
				
                if (this.view_log)
					this.log('HTTP successful LOGIN');
				this.authed = true;
            }
            catch (parseErr) {
				if (this.view_log) {
					this.log('Error processing received information login: ' + parseErr.message);
					this.log('Error processing received information login: ' + res.statusCode);
					this.log('Error processing received information login: ' + value);
				}
                error = parseErr;
            }
        }
    });
};
/*
Active
CurrentPosition
FilterLifeLevel 
FirmwareRevision 
HardwareRevision 
HoldPosition
MotionDetected 
Identify 
InUse 
Logs 
Manufacturer
Model
Name 
ObstructionDetected 
On
SerialNumber 
StatusActive 
StatusFault 
Version
AccessoryInformation 
*/


