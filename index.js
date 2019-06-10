var http = require('http');
var Accessory, Service, Characteristic, UUIDGen;

module.exports = function(homebridge) {
  console.log("homebridge API version: " + homebridge.version);

  // Accessory must be created from PlatformAccessory Constructor
  Accessory = homebridge.platformAccessory;

  // Service and Characteristic are from hap-nodejs
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  UUIDGen = homebridge.hap.uuid;
  
  // For platform plugin to be considered as dynamic platform plugin,
  // registerPlatform(pluginName, platformName, constructor, dynamic), dynamic must be true
  homebridge.registerPlatform("homebridge-boschindego", "BoschIndego", BoschIndego, true);
}

// Platform constructor
// config may be null
// api may be null if launched from old homebridge version
function BoschIndego(log, config, api) {
  log("BoschIndego Init");
  var platform = this;
  this.log = log;
  this.config = config;
  this.accessories = [];

  this.requestServer = http.createServer(function(request, response) {
    if (request.url === "/add") {
      this.addAccessory(new Date().toISOString());
      response.writeHead(204);
      response.end();
    }

    if (request.url == "/reachability") {
      this.updateAccessoriesReachability();
      response.writeHead(204);
      response.end();
    }

    if (request.url == "/remove") {
      this.removeAccessory();
      response.writeHead(204);
      response.end();
    }
  }.bind(this));

  this.requestServer.listen(18081, function() {
    platform.log("Server Listening...");
  });

  if (api) {
      // Save the API object as plugin needs to register new accessory via this object
      this.api = api;

      // Listen to event "didFinishLaunching", this means homebridge already finished loading cached accessories.
      // Platform Plugin should only register new accessory that doesn't exist in homebridge after this event.
      // Or start discover new accessories.
      this.api.on('didFinishLaunching', function() {
        platform.log("DidFinishLaunching");
      }.bind(this));
  }
}

// Function invoked when homebridge tries to restore cached accessory.
// Developer can configure accessory at here (like setup event handler).
// Update current value.
BoschIndego.prototype.configureAccessory = function(accessory) {
  this.log(accessory.displayName, "Configure Accessory");
  var platform = this;

  // Set the accessory to reachable if plugin can currently process the accessory,
  // otherwise set to false and update the reachability later by invoking 
  // accessory.updateReachability()
  accessory.reachable = true;

  accessory.on('identify', function(paired, callback) {
    platform.log(accessory.displayName, "Identify!!!");
    callback();
  });

  if (accessory.getService(Service.Lightbulb)) {
    accessory.getService(Service.Lightbulb)
    .getCharacteristic(Characteristic.On)
    .on('set', function(value, callback) {
      platform.log(accessory.displayName, "Light -> " + value);
      callback();
    });
  }

  this.accessories.push(accessory);
}

// Handler will be invoked when user try to config your plugin.
// Callback can be cached and invoke when necessary.
BoschIndego.prototype.configurationRequestHandler = function(context, request, callback) {
  this.log("Context: ", JSON.stringify(context));
  this.log("Request: ", JSON.stringify(request));

  // Check the request response
  if (request && request.response && request.response.inputs && request.response.inputs.name) {
    this.addAccessory(request.response.inputs.name);

    // Invoke callback with config will let homebridge save the new config into config.json
    // Callback = function(response, type, replace, config)
    // set "type" to platform if the plugin is trying to modify platforms section
    // set "replace" to true will let homebridge replace existing config in config.json
    // "config" is the data platform trying to save
    callback(null, "platform", true, {"platform":"BoschIndego", "otherConfig":"SomeData"});
    return;
  }

  // - UI Type: Input
  // Can be used to request input from user
  // User response can be retrieved from request.response.inputs next time
  // when configurationRequestHandler being invoked

  var respDict = {
    "type": "Interface",
    "interface": "input",
    "title": "Add Accessory",
    "items": [
      {
        "id": "name",
        "title": "Name",
        "placeholder": "Fancy Light"
      }//, 
      // {
      //   "id": "pw",
      //   "title": "Password",
      //   "secure": true
      // }
    ]
  }

  // - UI Type: List
  // Can be used to ask user to select something from the list
  // User response can be retrieved from request.response.selections next time
  // when configurationRequestHandler being invoked

  // var respDict = {
  //   "type": "Interface",
  //   "interface": "list",
  //   "title": "Select Something",
  //   "allowMultipleSelection": true,
  //   "items": [
  //     "A","B","C"
  //   ]
  // }

  // - UI Type: Instruction
  // Can be used to ask user to do something (other than text input)
  // Hero image is base64 encoded image data. Not really sure the maximum length HomeKit allows.

  // var respDict = {
  //   "type": "Interface",
  //   "interface": "instruction",
  //   "title": "Almost There",
  //   "detail": "Please press the button on the bridge to finish the setup.",
  //   "heroImage": "base64 image data",
  //   "showActivityIndicator": true,
  // "showNextButton": true,
  // "buttonText": "Login in browser",
  // "actionURL": "https://google.com"
  // }

  // Plugin can set context to allow it track setup process
  context.ts = "Hello";

  // Invoke callback to update setup UI
  callback(respDict);
}

// Sample function to show how developer can add accessory dynamically from outside event
BoschIndego.prototype.addAccessory = function(accessoryName) {
  this.log("Add Accessory");
  var platform = this;
  var uuid;

  uuid = UUIDGen.generate(accessoryName);

  var newAccessory = new Accessory(accessoryName, uuid);
  newAccessory.on('identify', function(paired, callback) {
    platform.log(newAccessory.displayName, "Identify!!!");
    callback();
  });
  // Plugin can save context on accessory to help restore accessory in configureAccessory()
  // newAccessory.context.something = "Something"
  
  // Make sure you provided a name for service, otherwise it may not visible in some HomeKit apps
  newAccessory.addService(Service.Lightbulb, "Test Light")
  .getCharacteristic(Characteristic.On)
  .on('set', function(value, callback) {
    platform.log(newAccessory.displayName, "Light -> " + value);
    callback();
  });

  this.accessories.push(newAccessory);
  this.api.registerPlatformAccessories("homebridge-boschindego", "BoschIndego", [newAccessory]);
}

BoschIndego.prototype.updateAccessoriesReachability = function() {
  this.log("Update Reachability");
  for (var index in this.accessories) {
    var accessory = this.accessories[index];
    accessory.updateReachability(false);
  }
}

// Sample function to show how developer can remove accessory dynamically from outside event
BoschIndego.prototype.removeAccessory = function() {
  this.log("Remove Accessory");
  this.api.unregisterPlatformAccessories("homebridge-boschindego", "BoschIndego", this.accessories);

  this.accessories = [];
}






/*


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


