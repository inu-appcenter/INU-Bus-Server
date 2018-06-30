const request = require('request');
const parser = require('xml2json');
const serviceKey = require('./config.js').INCHEON_BUS_KEY;

function getIncheonBusId(busNum){
  var options = {
    url : "http://openapi.tago.go.kr/openapi/service/BusRouteInfoInqireService/getRouteNoList?serviceKey=" + serviceKey + "&cityCode=23&routeNo=" + busNum + "&_type=json",
    method : 'GET'
  };
  request(options, function(err, res){
    if(!err){
      var body = JSON.parse(res.body);
      body = body.response.body;
      // console.log(JSON.stringify(body, null, '\t'));
      return body;
      // {
      //   "items": {
      //     "item": {
      //       "endnodenm": "송내역",
      //       "endvehicletime": 2306,
      //       "routeid": "ICB165000012",
      //       "routeno": 8,
      //       "routetp": "간선버스",
      //       "startnodenm": "인천대학교공과대학",
      //       "startvehicletime": "0505"
      //     }
      //   },
      //   "numOfRows": 10,
      //   "pageNo": 1,
      //   "totalCount": 1
      // }
    }
    else {
      console.log(err);
    }
  });
}

function getIncheonBusInfo(routeId){
  var options = {
    url : "http://openapi.tago.go.kr/openapi/service/BusRouteInfoInqireService/getRouteInfoIem?serviceKey=" + serviceKey + "&cityCode=23&routeId=" + routeId + "&_type=json",
    method : 'GET'
  };
  request(options, function(err, res){
    if(!err){
      var body = JSON.parse(res.body);
      body = body.response.body;
      // console.log(JSON.stringify(body, null, '\t'));
      return body;
      // {
      //   "items": {
      //     "item": {
      //       "endnodenm": "송내역",
      //       "endvehicletime": 2306,
      //       "routeid": "ICB165000012",
      //       "routeno": 8,
      //       "routetp": "간선버스",
      //       "startnodenm": "인천대학교공과대학",
      //       "startvehicletime": "0505"
      //     }
      //   },
      //   "numOfRows": 10,
      //   "pageNo": 1,
      //   "totalCount": 1
      // }
    }
    else {
      console.log(err);
    }
  });
}

function getIncheonBusRoutes(routeId){

  var options= {
    url : "http://openapi.tago.go.kr/openapi/service/BusRouteInfoInqireService/getRouteAcctoThrghSttnList?serviceKey=" + serviceKey + "&numOfRows=999&pageSize=999&pageNo=1&startPage=1&cityCode=23&_type=json&routeId=" + routeId,
    method : 'GET'
  };
  request(options, function(err,res){
    if(!err){
      var body = JSON.parse(res.body);
      body = body.response.body;
      console.log(JSON.stringify(body, null, '\t'));
      // {
      //   "items": {
      //     "item": [
      //       {
      //         "nodeid": "ICB164000377",
      //         "nodenm": "인천대학교공과대학",
      //         "nodeord": 1,
      //         "routeid": "ICB165000012"
      //       },
      //       .
      //       .
      //       {
      //         "nodeid": "ICB164000499",
      //         "nodenm": "인천대학교공과대학",
      //         "nodeord": 156,
      //         "routeid": "ICB165000012"
      //       }
      //     ]
      //   },
      //   "numOfRows": 999,
      //   "pageNo": 1,
      //   "totalCount": 156
      // }
      var info = getIncheonBusInfo(routeId);
      var item = body.items[0];
      var direction = 1;
      for(var i = 0; i < item.length; i++){
        item[i].direction = direction;
        if(item[i].nodenm == info.item[0].endnodenm){
          direction = 2;
        }
      }
      return body;
    }
    else {
      console.log(err);
    }
  });
  // request.get("http://openapi.tago.go.kr/openapi/service/BusRouteInfoInqireService/getRouteAcctoThrghSttnList?serviceKey=" + serviceKey + "&numOfRows=999&pageSize=999&pageNo=1&startPage=1&cityCode=23&routeId=" + routeId)
  // .on('response', function(response){
  //   console.log(JSON.stringify(response));
  // })
  // .on('error', function(error){
  //   console.log(error);
  // });
}

function getSeoulBusRoutes(routeId){
  request.get("http://ws.bus.go.kr/api/rest/busRouteInfo/getStaionByRoute?serviceKey=S3hIXxohUiQq2BhA595HRR2aN8I2j7a4iVJ7io4lvEv2LE0G6IgcAaDTJGwvcrpwRePhWH7a5cFr0qrxo2BqeA%3D%3D&busRouteId=" + routeId)
  .on('response', function(response){
    console.log(response);
  })
  .on('error', function(error){
    console.log(error);
  });
}
// getIncheonBusId(8);
console.log(JSON.stringify(getIncheonBusRoutes('ICB165000012'), null, '\t'));
