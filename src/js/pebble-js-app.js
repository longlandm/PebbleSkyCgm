var hasTimeline = 1;
var topic = "not_set";
var fix = 0;
var defaultId = 99;
var logging = 1;
// main function to retrieve, format, and send cgm data
function fetchCgmData() {
  
    //console.log ("START fetchCgmData");
                
    // declare local variables for message data
   // var response, responsebgs, responsecals, message;
   var opts = [ ].slice.call(arguments).pop( );
   opts = JSON.parse(localStorage.getItem('cgmPebble'));

   switch (opts.mode) {
          case "Nightscout":
            console.log("Nightscout data to be loaded");
         //   subscribeBy(opts.endpoint);
            
      //      opts.endpoint = opts.endpoint.replace("/pebble?units=mmol","");
      //      opts.endpoint = opts.endpoint.replace("/pebble/","");
     //       opts.endpoint = opts.endpoint.replace("/pebble","");
 
    //        if(opts.raw) {
    //            getNightscoutCalRecord(opts);
     //       } else {
               nightscout(opts); 
    //        }
            
             break;

        case "Share":
            console.log("Share data to be loaded");
            subscribeBy(opts.accountName);
            share(opts);
            break;
            
         default:
         Pebble.sendAppMessage({
                    "vibe": 1, 	
                    "egv": "set",		
                    "trend": 0,	
                    "alert": 4,
                    "delta": "setup up required",
                    "id": defaultId,
                    "time_delta_int": -1,
                });
         break;
    }
} // end fetchCgmData

function getNightscoutCalRecord(options){

    var url = options.api + "/api/v1/entries/cal.json?count=1";
    var http = new XMLHttpRequest();
    http.open("GET", url, true);
    http.onload = function (e) {
             
        if (http.status == 200) {
            var data = JSON.parse(http.responseText);
            //console.log("response: " + http.responseText);
             
            if (data.length === 0) {               
                options.raw = 0;
                nightscout(options);
            } else { 
                options.cal = {
                    'slope' : parseInt(data[0].slope, 10),
                    'intercept' : parseInt(data[0].intercept,10),
                    'scale' :  data[0].scale                  
                };
                nightscout(options);
            }

        } else {
           sendUnknownError("data err");
        }
    };
    
    http.onerror = function () {        
        sendServerError();
    };
    http.ontimeout = function () {
        sendTimeOutError();
    };

    try {
        http.send();
    }
    catch (e) {
        sendUnknownError("invalid url");
    }
    
    
}

function nightscout(opts)
{
   //console.log ("START fetchCgmData");
                
    // declare local variables for message data
    var response, responsebgs, responsecals, message;

    //get options from configuration window
  //  var opts = [ ].slice.call(arguments).pop( );
    //opts = JSON.parse(localStorage.getItem('cgmPebble'));

	// check if endpoint exists
    if (!opts.endpoint) {
        // endpoint doesn't exist, return no endpoint to watch
		// " " (space) shows these are init values, not bad or null values
        message = {
          icon: " ",
          bg: " ",
          tcgm: 0,
          tapp: 0,
          dlta: "NOEP",
          ubat: " ",
          name: " ",
          vals: " ",
          clrw: " ",
          rwuf: " ",
          noiz: 0
        };
        
        console.log("NO ENDPOINT JS message", JSON.stringify(message));
        MessageQueue.sendAppMessage(message);
        return;
    } // if (!opts.endpoint)
	
    // show current options
    //console.log("fetchCgmData IN OPTIONS = " + JSON.stringify(opts));
  
    // call XML
    var req = new XMLHttpRequest();
    
    // get cgm data
    req.open('GET', opts.endpoint, true);
    
    req.setRequestHeader('Cache-Control', 'no-cache');
	
    req.onload = function(e) {

        if (req.readyState == 4) {

            if(req.status == 200) {
                
                // clear the XML timeout
                clearTimeout(myCGMTimeout);
              
                // Load response   
                console.log(req.responseText);
                response = JSON.parse(req.responseText);
                responsebgs = response.bgs;
                responsecals = response.cals;
                
                // check response data
                if (responsebgs && responsebgs.length > 0) {

                    // response data is good; send log with response 
                    // console.log('got response', JSON.stringify(response));

                    // initialize message data
                  
                    // get direction arrow and BG
                    var currentDirection = responsebgs[0].direction,
                    values = " ",
                    currentIcon = "10",
                    currentBG = responsebgs[0].sgv,
                    //currentBG = "107",
                    currentConvBG = currentBG,
                    rawCalcOffset = 5,
                    specialValue = false,
                    calibrationValue = false,

                    // get timezone offset
                    timezoneDate = new Date(),
                    timezoneOffset = timezoneDate.getTimezoneOffset(),
                        
                    // get CGM time delta and format
                    readingTime = new Date(responsebgs[0].datetime).getTime(),
                    //readingTime = null,
                    formatReadTime = Math.floor( (readingTime / 1000) - (timezoneOffset * 60) ),

                    // get app time and format
                    appTime = new Date().getTime(),
                    //appTime = null,
                    formatAppTime = Math.floor( (appTime / 1000) - (timezoneOffset * 60) ),   
                    
                    // get BG delta and format
                    currentBGDelta = responsebgs[0].bgdelta,
                    //currentBGDelta = -8,
                    formatBGDelta = " ",

                    // get battery level
                    currentBattery = responsebgs[0].battery,
                    //currentBattery = "100",
 
                   // get NameofT1DPerson and IOB
                    NameofT1DPerson = opts.t1name,
                    currentIOB = responsebgs[0].iob,
 
                    // sensor fields
                    currentCalcRaw = 0,
                    //currentCalcRaw = 100000,
                    formatCalcRaw = " ",
                    currentRawFilt = responsebgs[0].filtered,
                    formatRawFilt = " ",
                    currentRawUnfilt = responsebgs[0].unfiltered,
                    formatRawUnfilt = " ",
                    currentNoise = responsebgs[0].noise,
                    currentIntercept = "undefined",
                    currentSlope = "undefined",
                    currentScale = "undefined",
                    currentRatio = 0;
  
                    // get name of T1D; if iob (case insensitive), use IOB
                    if ( (NameofT1DPerson.toUpperCase() === "IOB") && 
                    ((typeof currentIOB != "undefined") && (currentIOB !== null)) ) {
                      NameofT1DPerson = "IOB:" + currentIOB;
                    }
                    else {
                      NameofT1DPerson = opts.t1name;
                    }
  
                    if (responsecals && responsecals.length > 0) {
                      currentIntercept = responsecals[0].intercept;
                      currentSlope = responsecals[0].slope;
                      currentScale = responsecals[0].scale;
                    }
                  
                    //currentDirection = "NONE";

                    // set some specific flags needed for later
                    if (opts.radio == "mgdl_form") { 
                      if ( (currentBG < 40) || (currentBG > 400) ) { specialValue = true; }
                      if (currentBG == 5) { calibrationValue = true; }
                    }
                    else {
                      if ( (currentBG < 2.3) || (currentBG > 22.2) ) { specialValue = true; }
                      if (currentBG == 0.3) { calibrationValue = true; }
                      currentConvBG = (Math.round(currentBG * 18.018).toFixed(0));                                                                   
                    }
              
                    // convert arrow to a number string; sending number string to save memory
                    // putting NOT COMPUTABLE first because that's most common and can get out fastest
                    switch (currentDirection) {
                      case "NOT COMPUTABLE": currentIcon = "8"; break;
                      case "NONE": currentIcon = "0"; break;
                      case "DoubleUp": currentIcon = "1"; break;
                      case "SingleUp": currentIcon = "2"; break;
                      case "FortyFiveUp": currentIcon = "3"; break;
                      case "Flat": currentIcon = "4"; break;
                      case "FortyFiveDown": currentIcon = "5"; break;
                      case "SingleDown": currentIcon = "6"; break;
                      case "DoubleDown": currentIcon = "7"; break;
                      case "RATE OUT OF RANGE": currentIcon = "9"; break;
                      default: currentIcon = "10";
                    }
					
                    // if no battery being sent yet, then send nothing to watch
                    // console.log("Battery Value: " + currentBattery);
                    if ( (typeof currentBattery == "undefined") || (currentBattery === null) ) {
                      currentBattery = " ";  
                    }
                  
                    // assign bg delta string
                    formatBGDelta = ((currentBGDelta > 0 ? '+' : '') + currentBGDelta);

                    //console.log("Current Unfiltered: " + currentRawUnfilt);                  
                    //console.log("Current Intercept: " + currentIntercept);
                    //console.log("Special Value Flag: " + specialValue);
                    //console.log("Current BG: " + currentBG);
                  
                    // assign calculated raw value if we can
                    if ( (typeof currentIntercept != "undefined") && (currentIntercept !== null) ){
                        if (specialValue) {
                          // don't use ratio adjustment
                          currentCalcRaw = ((currentScale * (currentRawUnfilt - currentIntercept) / currentSlope)*1 - rawCalcOffset*1);
                          //console.log("Special Value Calculated Raw: " + currentCalcRaw);
                        } 
                        else {
                          currentRatio = (currentScale * (currentRawFilt - currentIntercept) / currentSlope / (currentConvBG*1 + rawCalcOffset*1));
                          currentCalcRaw = ((currentScale * (currentRawUnfilt - currentIntercept) / currentSlope / currentRatio)*1 - rawCalcOffset*1);
                          //console.log("Current Converted BG: " + currentConvBG);
                          //console.log("Current Ratio: " + currentRatio);
                          //console.log("Normal BG Calculated Raw: " + currentCalcRaw);
                        }          
                    } // if currentIntercept                  

                    // assign raw sensor values if they exist
                    if ( (typeof currentRawUnfilt != "undefined") && (currentRawUnfilt !== null) ) {
                      
                      // zero out any invalid values; defined anything not between 0 and 900
                      if ( (currentRawFilt < 0) || (currentRawFilt > 900000) || 
                            (isNaN(currentRawFilt)) ) { currentRawFilt = "ERR"; }
                      if ( (currentRawUnfilt < 0) || (currentRawUnfilt > 900000) || 
                            (isNaN(currentRawUnfilt)) ) { currentRawUnfilt = "ERR"; }
                      
                      // set 0, LO and HI in calculated raw
                      if ( (currentCalcRaw >= 0) && (currentCalcRaw < 30) ) { formatCalcRaw = "LO"; }
                      if ( (currentCalcRaw > 500) && (currentCalcRaw <= 900) ) { formatCalcRaw = "HI"; }
                      if ( (currentCalcRaw < 0 ) || (currentCalcRaw > 900) ) { formatCalcRaw = "ERR"; }
                      
                      // if slope is 0 or if currentCalcRaw is NaN, 
                      // calculated raw is invalid and need a calibration
                      if ( (currentSlope === 0) || (isNaN(currentCalcRaw)) ) { formatCalcRaw = "CAL"; }
                      
                      // check for compression warning
                      if ( ((currentCalcRaw < (currentRawFilt/1000)) && (!calibrationValue)) && (currentRawFilt !== 0) ){
                        var compressionSlope = 0;
                        compressionSlope = (((currentRawFilt/1000) - currentCalcRaw)/(currentRawFilt/1000));
                        //console.log("compression slope: " + compressionSlope);
                        if (compressionSlope > 0.7) {
                          // set COMPRESSION? message
                          formatBGDelta = "PRSS";
                        } // if compressionSlope
                      } // if check for compression condition
                      
                      if (opts.radio == "mgdl_form") { 
                        formatRawFilt = ((Math.round(currentRawFilt / 1000)).toFixed(0));
                        formatRawUnfilt = ((Math.round(currentRawUnfilt / 1000)).toFixed(0));
                        if ( (formatCalcRaw != "LO") && (formatCalcRaw != "HI") && 
                             (formatCalcRaw != "ERR") && (formatCalcRaw != "CAL") ) 
                            { formatCalcRaw = ((Math.round(currentCalcRaw)).toFixed(0)); }
                        //console.log("Format Unfiltered: " + formatRawUnfilt);
                      } 
                      else {
                        formatRawFilt = ((Math.round(((currentRawFilt/1000)*0.0555) * 10) / 10).toFixed(1));
                        formatRawUnfilt = ((Math.round(((currentRawUnfilt/1000)*0.0555) * 10) / 10).toFixed(1));
                        if ( (formatCalcRaw != "LO") && (formatCalcRaw != "HI") &&
                             (formatCalcRaw != "ERR") && (formatCalcRaw != "CAL") ) 
                        { formatCalcRaw = ((Math.round(currentCalcRaw)*0.0555).toFixed(1)); }
                        //console.log("Format Unfiltered: " + formatRawUnfilt);
                      }
                    } // if currentRawUnfilt 
                  
                    //console.log("Calculated Raw To Be Sent: " + formatCalcRaw);
                  
                    // assign blank noise if it doesn't exist
                    if ( (typeof currentNoise == "undefined") || (currentNoise === null) ) {
                      currentNoise = 0;  
                    }
                    
                    if (opts.radio == "mgdl_form") {
                      values = "0";  //mgdl selected
                    } else {
                      values = "1"; //mmol selected
                    }
                    values += "," + opts.lowbg;  //Low BG Level
                    values += "," + opts.highbg; //High BG Level                      
                    values += "," + opts.lowsnooze;  //LowSnooze minutes 
                    values += "," + opts.highsnooze; //HighSnooze minutes
                    values += "," + opts.lowvibe;  //Low Vibration 
                    values += "," + opts.highvibe; //High Vibration
                    values += "," + opts.vibepattern; //Vibration Pattern
                    if (opts.timeformat == "12"){
                      values += ",0";  //Time Format 12 Hour  
                    } else {
                      values += ",1";  //Time Format 24 Hour  
                    }
                    // Vibrate on raw value in special value; Yes = 1; No = 0;
                    if ( (currentCalcRaw !== 0) && (opts.rawvibrate == "1") ) {
                      values += ",1";  // Vibrate on raw value when in special values  
                    } else {
                      values += ",0";  // Do not vibrate on raw value when in special values                        
                    }
                    
                    //console.log("Current Value: " + values);
                    //console.log("Current rawvibrate: " + opts.rawvibrate);
                    //console.log("Current currentCalcRaw: " + currentCalcRaw);
                  
                    // debug logs; uncomment when need to debug something
 
                    //console.log("current Direction: " + currentDirection);
                    //console.log("current Icon: " + currentIcon);
                    //console.log("current BG: " + currentBG);
                    //console.log("now: " + formatAppTime);
                    //console.log("readingtime: " + formatReadTime);
                    //console.log("current BG delta: " + currentBGDelta);
                    //console.log("current Formatted Delta: " + formatBGDelta);              
                    //console.log("current Battery: " + currentBattery);
                    
                    // load message data  
                    message = {
                      icon: currentIcon,
                      bg: currentBG,
                      tcgm: formatReadTime,
                      tapp: formatAppTime,
                      dlta: formatBGDelta,
                      ubat: currentBattery,
                      name: NameofT1DPerson,
                      vals: values,
                      clrw: formatCalcRaw,
                      rwuf: formatRawUnfilt,
                      noiz: currentNoise
                    };
                    
                    // send message data to log and to watch
                    console.log("JS send message: " + JSON.stringify(message));
                    MessageQueue.sendAppMessage(message);

                // response data is not good; format error message and send to watch
                // have to send space in BG field for logo to show up on screen				
                } else {
                  
                    // " " (space) shows these are init values (even though it's an error), not bad or null values
                    message = {
                      dlta: "OFF"
                    };
                  
                    console.log("DATA OFFLINE JS message", JSON.stringify(message));
                    MessageQueue.sendAppMessage(message);
                }
            } // end req.status == 200
        } // end req.readyState == 4
    }; // req.onload
    req.send(null);
    var myCGMTimeout = setTimeout (function () {
      req.abort();
      message = {
        dlta: "OFF"
      };          
      console.log("DATA OFFLINE JS message", JSON.stringify(message));
      MessageQueue.sendAppMessage(message);
    }, 59000 ); // timeout in ms; set at 45 seconds; can not go beyond 59 seconds   
}

function subscribeBy(base) {
    try {        
        topic = hashCode(base).toString();
        logging("hashcode:" + topic);
        Pebble.getTimelineToken(
            function (token) {
                //console.log('My timeline token is: ' + token);
            },
            function (error) {
                //console.log('Error getting timeline token: ' + error);
                hasTimeline = 0;
            }
            );
        Pebble.timelineSubscribe(topic,
            function () {
                //console.log('Subscribed to: ' + topic);
            },
            function (errorString) {
                //console.log('Error subscribing to topic: ' + errorString);
                hasTimeline = 0;
            }
            );
    } catch (err) {
        //console.log('Error: ' + err.message);
        hasTimeline = 0;
    }
    
    if (hasTimeline)
        cleanupSubscriptions();

}


//use D's share API------------------------------------------//
function share(options) {

    if (options.unit == "mgdl" || options.unit == "mg/dL")
    {
        fix = 0;
        options.conversion = 1;
        options.unit = "mg/dL";
        
    } else {
        fix = 1;
        options.conversion = 0.0555;       
        options.unit = "mmol/L";
    }
    options.vibe = parseInt(options.vibe, 10);
    var defaults = {
        "applicationId": "d89443d2-327c-4a6f-89e5-496bbb0317db",
        "agent": "Dexcom Share/3.0.2.11 CFNetwork/711.2.23 Darwin/14.0.0",
        login: 'https://share1.dexcom.com/ShareWebServices/Services/General/LoginPublisherAccountByName',
        accept: 'application/json',
        'content-type': 'application/json',
        LatestGlucose: "https://share1.dexcom.com/ShareWebServices/Services/Publisher/ReadPublisherLatestGlucoseValues"
    };

    authenticateShare(options, defaults);
}

function authenticateShare(options, defaults) {   
 
    var body = {
        "password": options.password,
        "applicationId": options.applicationId || defaults.applicationId,
        "accountName": options.accountName
    };

    var http = new XMLHttpRequest();
    var url = defaults.login;
    http.open("POST", url, true);
    http.setRequestHeader("User-Agent", defaults.agent);
    http.setRequestHeader("Content-type", defaults['content-type']);
    http.setRequestHeader('Accept', defaults.accept);
    
    var data;
    http.onload = function (e) {
        if (http.status == 200) {
            data = getShareGlucoseData(http.responseText.replace(/['"]+/g, ''), defaults, options);
        } else {
                sendAuthError();           
        }
    };
    
       http.ontimeout = function () {
        sendTimeOutError();
    };
    
    http.onerror = function () {
        sendServerError();
    };

    http.send(JSON.stringify(body));

}
function sendAuthError() {
    Pebble.sendAppMessage({
                    "vibe": 1, 	
                    "egv": "log",		
                    "trend": 0,	
                    "alert": 4,
                    "delta": "login err",
                    "id": defaultId,
                    "time_delta_int": -1,
                });
}

function sendTimeOutError(options) {
     Pebble.sendAppMessage({
            "vibe": parseInt(options.vibe_temp,10),
            "egv": "tot",
            "trend": 0,
            "alert": 4,
            "delta": "tout-err",
            "id": defaultId,
            "time_delta_int": -1,
        });
}

function sendServerError(options) {
    Pebble.sendAppMessage({
            "vibe": parseInt(options.vibe_temp,10),
            "egv": "svr",
            "trend": 0,
            "alert": 4,
            "delta": "net-err",
            "id": defaultId,
            "time_delta_int": -1,
        });
}

function sendUnknownError(msg) {
    Pebble.sendAppMessage({
                "delta": msg,
                "egv": "exc",
                "trend": 0,
                "alert": 4,
                "vibe": 0,
                "id": defaultId,
                "time_delta_int": -1,
            }); 
}


function getShareGlucoseData(sessionId, defaults, options) {
    var now = new Date();
    var http = new XMLHttpRequest();
    var url = defaults.LatestGlucose + '?sessionID=' + sessionId + '&minutes=' + 1440 + '&maxCount=' + 8;
    http.open("POST", url, true);

    //Send the proper header information along with the request
    http.setRequestHeader("User-Agent", defaults.agent);
    http.setRequestHeader("Content-type", defaults['content-type']);
    http.setRequestHeader('Accept', defaults.accept);
    http.setRequestHeader('Content-Length', 0);
    var trend = null;
    http.onload = function (e) {
             
        if (http.status == 200) {
            var data = JSON.parse(http.responseText);
           // console.log("response: " + http.responseText);
            //handle arrays less than 2 in length
            if (data.length === 0) {                
                sendUnknownError("data err");
            } else { 
            
                //TODO: calculate loss
                var regex = /\((.*)\)/;
                var wall = parseInt(data[0].WT.match(regex)[1]);
              console.log("Data: " + data);
                var timeAgo = now.getTime() - wall;       

                var egv, delta, convertedDelta;

                if (data.length == 1) {
                    delta = "can't calc";
                } else {
                    var timeBetweenReads = parseInt(data[0].WT.match(regex)[1]) - parseInt(data[1].WT.match(regex)[1]);
                    var minutesBetweenReads = (timeBetweenReads / (1000 * 60)).toFixed(1);                                               
                    var deltaZero = data[0].Value * options.conversion;
                    var deltaOne = data[1].Value * options.conversion;
                    convertedDelta = (deltaZero - deltaOne);                   
                    delta = ((convertedDelta/minutesBetweenReads) * 5).toFixed(fix);
                    console.log("delta: " + delta);
                }

              var convertedEgv = null;
                //Manage HIGH & LOW
                if (data[0].Value < 40) {
                    egv = "low";
                    delta = "check bg";
                    trend = 0;
                    console.log("---------------LOW");
                } else if (data[0].Value > 400) {
                    egv = "hgh";
                    delta = "check bg";
                    trend = 0;
                    logging("---------------HIGH");
                } else {
                    convertedEgv = (data[0].Value * options.conversion);
                    egv = (convertedEgv < 39 * options.conversion) ? parseFloat(Math.round(convertedEgv * 100) / 100).toFixed(1).toString() : convertedEgv.toFixed(fix).toString();
                    delta = (convertedEgv < 39 * options.conversion) ? parseFloat(Math.round(convertedDelta * 100) / 100).toFixed(1) : convertedDelta.toFixed(fix);
                    
                    
                    
                    
                    var deltaString = (delta > 0) ? "+" + delta.toString() : delta.toString();
			          		delta = deltaString + options.unit;
                    trend = (data[0].Trend > 7) ? 0 : data[0].Trend;

                    options.egv = data[0].Value;
                    console.log("---------------HIGH");
                }
                var alert = calculateShareAlert(convertedEgv, wall, options);
                var timeDeltaMinutes = Math.floor(timeAgo / 60000);              
                var d = new Date(wall);
                var n = d.getMinutes();
                var pin_id_suffix = 5 * Math.round(n / 5);
                var title = "[SPARK] " + egv + " " + options.unit;
                var pin = {
                    "id": "pin-egv" + topic + pin_id_suffix,
                    "time": d.toISOString(),
                    "duration": 5,
                    "layout": {
                        "type": "genericPin",
                        "title": title,
                        "body": "Dexcom Share",
                        "tinyIcon": "system://images/GLUCOSE_MONITOR",
                        "backgroundColor": "#FF5500"
                    },
                    "actions": [
                        {
                            "title": "Launch App",
                            "type": "openWatchApp",
                            "launchCode": 1
                        }],

                };
                
                
                //Manage OLD data
  // GRANT REMOVED JUST NOW             
//                 if (timeDeltaMinutes >= 15) {
//                     console.log("Timedelta more than 15 minutes");
//                     delta = "no data";
//                     trend = 0;
//                     egv = "old";
//                     if (timeDeltaMinutes % 5 === 0)
//                         alert = 4;
//                 }
                
              console.log("delta: " + delta);
                console.log("egv: " + egv);
                console.log("trend: " + trend);
                console.log("alert: " + alert);
                console.log("vibe: " + options.vibe_temp);
                console.log("id: " + wall);
                console.log("time_delta_int: " + timeDeltaMinutes);
                console.log("bgs: " + createShareBgArray(data));
               console.log("bg_times: " + createShareBgTimeArray(data));
              Pebble.sendAppMessage({
                    "dlta": delta,
                    "bg": egv,	
                    "trend": trend,	
                    "alert": alert,	
                //    "vibe": options.vibe_temp,
                 //   "id": wall,
               //     "time_delta_int": timeDeltaMinutes,
                 //   "bgs" : createShareBgArray(data),
                 //   "bg_times" : createShareBgTimeArray(data)
                });
                options.id = wall;
            //    window.localStorage.setItem('cgmPebbleDuo', JSON.stringify(options));
                
                if (hasTimeline) {
                    insertUserPin(pin, topic, function (responseText) {
                    console.log('Result: ' + responseText);
                    });
                }  
            }

        } else {
            sendUnknownError("data err");
        }
    };
    
    http.onerror = function () { 
        sendServerError();
    };
   http.ontimeout = function () {
        sendTimeOutError();
    };

    http.send();
}

function createShareBgArray(data) {
    var toReturn = "0,";
    var regex = /\((.*)\)/;
    var now = new Date();
  console.log("Data:" + data.length);
    for (var i = 0; i < data.length; i++) {
        var wall = parseInt(data[i].WT.match(regex)[1]);
     
        var timeAgo = msToMinutes(now.getTime() - wall);
   //    console.log("timeAgo:" + timeAgo);
        if (timeAgo < 45) {  
            toReturn = toReturn + data[i].Value.toString() + ",";
        }
    }
    toReturn = toReturn.replace(/,\s*$/, "");  
    return toReturn;
}
    

function createShareBgTimeArray(data) {
    var toReturn = "";
    var regex = /\((.*)\)/;
    var now = new Date();
    
    for (var i = 0; i < data.length; i++) {  
        var wall = parseInt(data[i].WT.match(regex)[1]);
        console.log("createShareBgTimeArray wall:" + wall);
        var timeAgo = msToMinutes(now.getTime() - wall);
 //       console.log("timeago: " + timeAgo);
        if (timeAgo < 45) {
            toReturn = toReturn + (45-timeAgo).toString() + ",";
        }
    } 
    toReturn = toReturn.replace(/,\s*$/, "");  
    return toReturn;  
}

function msToMinutes(millisec) {
    return (millisec / (1000 * 60)).toFixed(1);
}

function calculateShareAlert(egv, currentId, options) {
    //console.log("comparing: " + currentId + " to " + options.id);
    if (parseInt(options.id, 10) == parseInt(currentId, 10)) {
        options.vibe_temp = 0;
    } else {
        options.vibe_temp = options.vibe + 1;
    }

    if (egv <= options.low){
        return 2;
    }

    if (egv >= options.high) {
        return 1;
    }
        
    return 0;
}
function insertUserPin(pin, topic, callback) {
    if (topic != "not_set")
        timelineRequest(pin, topic, 'PUT', callback);
}

// The timeline public URL root
var API_URL_ROOT = 'https://timeline-api.getpebble.com/';

function timelineRequest(pin, topic, type, callback) {
    
    // User or shared?
    //var url = API_URL_ROOT + 'v1/user/pins/' + pin.id;
    var url = API_URL_ROOT + 'v1/shared/pins/' + pin.id;
    // Create XHR
    var xhr = new XMLHttpRequest();
    xhr.onload = function() {
        //console.log('timeline: response received: ' + this.responseText);
        callback(this.responseText);
    };
    
    
    xhr.open(type, url);

    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('X-API-Key', '');
    xhr.setRequestHeader('X-Pin-Topics', topic);

    // Send
    xhr.send(JSON.stringify(pin));
    //console.log('timeline: request sent.');
   
    var xhrSb = new XMLHttpRequest();
    xhrSb.onload = function() {
        //console.log('timeline: response received: ' + this.responseText);
        callback(this.responseText);
    };
    xhrSb.open(type, url);
   
    xhrSb.setRequestHeader('Content-Type', 'application/json');
    xhrSb.setRequestHeader('X-API-Key', '');
    xhrSb.setRequestHeader('X-Pin-Topics', topic); 
    
    xhrSb.send(JSON.stringify(pin));
    //console.log('timeline: SB request sent.');
   
}


function cleanupSubscriptions() {
    Pebble.timelineSubscriptions(
        function (topics) {
            console.log('Subscribed to ' + topics.join(','));
            //console.log("subs: " + topics);
            for (var i = 0; i < topics.length; i++) {
                //console.log("topic: " + topic)
                //console.log("topics[i]: " + topics[i])
                if (topic != topics[i]) {
                    Pebble.timelineUnsubscribe(topics[i],
                        function () {
                            //console.log('Unsubscribed from: ' + topics[i]);
                        },
                        function (errorString) {
                            //console.log('Error unsubscribing from topic: ' + errorString);
                        }
                        );
                }
            }

        },
        function (errorString) {
            //console.log('Error getting subscriptions: ' + errorString);
            return ",";
        }
        );
}


function hashCode(base) {
    var hash = 0, i, chr, len;
    if (base.length === 0) return hash;
    for (i = 0, len = base.length; i < len; i++) {
        chr = base.charCodeAt(i);
        hash = ((hash << 5) - hash) + chr;
        hash |= 0; // Convert to 32bit integer
    }
    return hash;
}

function logging(message)
{
  if(logging)
    console.log(message);
}
// message queue-ing to pace calls from C function on watch
var MessageQueue = (function () {
                    
                    var RETRY_MAX = 5;
                    
                    var queue = [];
                    var sending = false;
                    var timer = null;
                    
                    return {
                    reset: reset,
                    sendAppMessage: sendAppMessage,
                    size: size
                    };
                    
                    function reset() {
                    queue = [];
                    sending = false;
                    }
                    
                    function sendAppMessage(message, ack, nack) {
                    
                    if (! isValidMessage(message)) {
                    return false;
                    }
                    
                    queue.push({
                               message: message,
                               ack: ack || null,
                               nack: nack || null,
                               attempts: 0
                               });
                    
                    setTimeout(function () {
                               sendNextMessage();
                               }, 1);
                    
                    return true;
                    }
                    
                    function size() {
                    return queue.length;
                    }
                    
                    function isValidMessage(message) {
                    // A message must be an object.
                    if (message !== Object(message)) {
                    return false;
                    }
                    var keys = Object.keys(message);
                    // A message must have at least one key.
                    if (! keys.length) {
                    return false;
                    }
                    for (var k = 0; k < keys.length; k += 1) {
                    var validKey = /^[0-9a-zA-Z-_]*$/.test(keys[k]);
                    if (! validKey) {
                    return false;
                    }
                    var value = message[keys[k]];
                    if (! validValue(value)) {
                    return false;
                    }
                    }
                    
                    return true;
                    
                    function validValue(value) {
                    switch (typeof(value)) {
                    case 'string':
                    return true;
                    case 'number':
                    return true;
                    case 'object':
                    if (toString.call(value) == '[object Array]') {
                    return true;
                    }
                    }
                    return false;
                    }
                    }
                    
                    function sendNextMessage() {
                    
                    if (sending) { return; }
                    var message = queue.shift();
                    if (! message) { return; }
                    
                    message.attempts += 1;
                    sending = true;
                    Pebble.sendAppMessage(message.message, ack, nack);
                    
                    timer = setTimeout(function () {
                                       timeout();
                                       }, 1000);
                    
                    function ack() {
                    clearTimeout(timer);
                    setTimeout(function () {
                               sending = false;
                               sendNextMessage();
                               }, 200);
                    if (message.ack) {
                    message.ack.apply(null, arguments);
                    }
                    }
                    
                    function nack() {
                    clearTimeout(timer);
                    if (message.attempts < RETRY_MAX) {
                    queue.unshift(message);
                    setTimeout(function () {
                               sending = false;
                               sendNextMessage();
                               }, 200 * message.attempts);
                    }
                    else {
                    if (message.nack) {
                    message.nack.apply(null, arguments);
                    }
                    }
                    }
                    
                    function timeout() {
                    setTimeout(function () {
                               sending = false;
                               sendNextMessage();
                               }, 1000);
                    if (message.ack) {
                    message.ack.apply(null, arguments);
                    }
                    }
                    
                    }
                    
                    }());					
// pebble specific calls with watch
Pebble.addEventListener("ready",
                        function(e) {
                        "use strict";
                        console.log("Pebble JS ready");
                        });

Pebble.addEventListener("appmessage",
                        function(e) {
                        console.log("JS Recvd Msg From Watch: " + JSON.stringify(e.payload));
                        fetchCgmData();
                        });

Pebble.addEventListener("showConfiguration", function(e) {
                        console.log("Showing Configuration", JSON.stringify(e));
                        Pebble.openURL('http://ducks_cgm.bitbucket.org/cgm-pebble/testconfig2.html');
                        //Pebble.openURL('http://ducks_cgm.bitbucket.org/cgm-pebble/share_nightscout_V1.html');
                     //   Pebble.openURL('http://cgmwatch.azurewebsites.net/config.2.html');
 
                        });

Pebble.addEventListener("webviewclosed", function(e) {
                        var opts = JSON.parse(decodeURIComponent(e.response));
                        console.log("CLOSE CONFIG OPTIONS = " + JSON.stringify(opts));
                        // store endpoint in local storage
                        localStorage.setItem('cgmPebble', JSON.stringify(opts));                      
                        });


