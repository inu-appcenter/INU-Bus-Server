const express = require('express');

const app = express();

const fs = require('fs');

const mysql  = require('mysql');

const request = require('sync-request');

const bodyParser = require('body-parser');

const convert = require('xml-js');



// 쿼리 사용량과 서버 종료 직전까지의 정보를 저장해둠.

const dataStoreName = "stored.txt";

// API 변수 선언.

const config = require('./config.js');

const port = config.PORT;

// 서비스 계정 두개 필요

const serviceKey1 = config.SERVICE_KEY1;

const serviceKey2 = config.SERVICE_KEY2;

const serviceKey3 = config.SERVICE_KEY3;

const serviceKeys = [serviceKey1, serviceKey2, serviceKey3];

const cityCode = '23';  // 인천



const arrivalinfoPath = '/openapi/service/ArvlInfoInqireService/getSttnAcctoArvlPrearngeInfoList';    // 버스 도착정보 path

const seoulbusPath = '/api/rest/arrive/getArrInfoByRouteAll';

const busnodePath = '/openapi/service/BusRouteInfoInqireService/getRouteAcctoThrghSttnList'; // 버스 정류장 path

const leftnodePath = '/openapi/service/BusLcInfoInqireService/getRouteAcctoBusLcList'; // 남은정류장계산



var storeData = {

  currentquerycount : { Incheon : 0, Seoul : 0},

  querycountIncheon : [0, 0, 0],

  querycountSeoul : [0, 0, 0],

  queryDate:'',

  busdata:''

};



var countIncheon = 0;

// var countSeoul = 0;



var serviceKeyIncheon = serviceKeys[0];

var serviceKeyIncheon2 = serviceKeys[1]; // 1번 serviceKey로는 운영계정신청이 안되어있어서 6-2의 남은노드 조회 쿼리가 모자른것같음

var serviceKeySeoul = serviceKeys[0]; // serviceKey1



var jnodes = ['ICB164000373', 'ICB164000403','ICB164000380', 'ICB164000395'];

// 2,3,4번출구,인입

var seouldatas = [];

var busNodes = [];

var jijeongdandata = [];

var datas = [];



//const ENTRANCE_STATION_OUTDIR = 'ICB164000385';        // 인천대입구역 나가는 방향 정류장 ID

app.use(express.static('public'));

app.use(bodyParser.json());

app.use(bodyParser.urlencoded({extended: true}));



var arrivalInfo = [];    // 클라이언트에 전송할 도착 정보가 담기는 JSON

/*[{

  name:"engineer":

  [{no:,

    arrival:,

    start:,

    end:,

    interval:

  },...]

},...]*/



// direction to:지정단에 스는지, from:하교할때 나오는지

// 참조할 버스들 기본 정보 (회차지 추가)
const buses = config.BUS_TIME_TABLE;

// 각 정류장에 대한 데이터 정의 busstop으로 통칭.
var FRONTGATE = config.BUS_STOP_FRONTGATE;
var SCIENCE = config.BUS_STOP_SCIENCE;
var ENGINEER = config.BUS_STOP_ENGINEER;


/*{bus:buses, gaptime:180, refstop:FRONTGATE|ENGINEER|SCIENCE, ref:true/false}

각 정류장에서 필요한 버스를 담아둔다.

pbus는 각 정류장마다 차이 시간이 다르므로, gaptime이 있고, 참조 정류장을 확인해야하므로,ref는 true이다.

*/

var checkDataList = [];



/*

버스 도착정보를 가져올 정류장을 담아둔다.

checkDataList를 참조해 작성하며 이 리스트로 도착정보를 일괄적으로 받아 처리한다.

추후, 버스 첫차, 막차시간, 배차시간을 이용해 사용하는 쿼리 수를 줄인다.

*/

var checkNodeList = [];





getbusNodes();

loadStoredData();

setInterval(function()

{

  mainprocess();

},

30000);



function mainprocess(){

  putCheckDataList(FRONTGATE);

  putCheckDataList(SCIENCE);

  putCheckDataList(ENGINEER);

  makeCheckNodeList()

  totaldata = getBusData();

  parseBusData(totaldata);

  parseJijeongdan();

  fs.writeFileSync(dataStoreName, JSON.stringify(storeData), 'utf8');

  checkQueryCount();

  console.log('updated at ' + getDateTime());

  console.log('query used(incheon, ' + checkServiceKey(serviceKeyIncheon) + ') : '+storeData.currentquerycount.Incheon);

  console.log('query used(seoul, ' + checkServiceKey(serviceKeySeoul) + ') : '+storeData.currentquerycount.Seoul+'\n');

}



// ㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡ 함수 정의 ㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡ



function checkQueryCount(){

  if(storeData.currentquerycount.Incheon >= 10000){
    for(var i=0; i<3; i++){
      if(serviceKeyIncheon == serviceKeys[i]){
        serviceKeyIncheon = serviceKeys[(i+1)%3];
        console.log('serviceKeyIncheon : '+checkServiceKey(serviceKeys[i])+' changes into '+checkServiceKey(serviceKeys[(i+1)%3]));
        break;
      }
    }
    storeData.currentquerycount.Incheon = 0;
  }


  if(storeData.currentquerycount.Seoul >= 10000){
    for(var i=0; i<3; i++){
      if(serviceKeySeoul == serviceKeys[i]){
          serviceKeySeoul = serviceKeys[(i+1)%3];
          console.log('serviceKeySeoul : '+checkServiceKey(serviceKeys[i])+' changes into '+checkServiceKey(serviceKeys[(i+1)%3]));
          break;
      }
    }
    storeData.currentquerycount.Seoul = 0;
  }

}



function checkServiceKey(ServiceKey){

  for(var i=0; i<3; i++){

    if(ServiceKey == serviceKeys[i]){

      return 'serviceKey'+(((i+1)%3)+1);

    }

  }

}




function loadStoredData()

{

    try {

      var date = new Date();

      var data = fs.readFileSync('stored.txt', 'utf8'); //Syntax에러 발생시 .substring(1) 추가

      if(data == null) return;

      data = JSON.parse(data);

      console.log(data);

      if(data.queryDate === getCurrentDate())

      {

        storeData.currentquerycount.Incheon = parseInt(data.currentquerycount.Incheon,10);

        storeData.currentquerycount.Seoul = parseInt(data.currentquerycount.Seoul, 10);

        storeData.queryDate = data.queryDate;

        for(var i=0; i<3; i++){
          storeData.querycountSeoul[i] = data.querycountSeoul[i];
          storeData.querycountIncheon[i] = data.querycountIncheon[i];
        }

        // TODO 저장된 버스 정보도 허용 시간 범위내에서 로드 하도록.

      }

      else

      {

        storeData.currentquerycount.Incheon = 0;

        storeData.currentquerycount.Seoul = 0;

        storeData.queryDate = getCurrentDate();

      }



      if(data.busdata !== "")

      {

        arrivalInfo = data.busdata;

      }

    }

    catch (e){

      console.log(dataStoreName + ' file read error\n' + e);

    }



}



function putCheckDataList(busstop){

  // 일반적인 버스 정보 조회

  for(var i = 0 ; i < busstop.nbus.length; i++)

  {

    var time = new Date().getHours()*100;

    var refbus1 = getBusIndex(busstop.nbus[i]);

    if(refbus1 <= 0)

    {

      console.log(busstop.id + '에서 nbus ' + i + '번째 정보 찾기 오류');

      console.log(busstop.nbus);

      //return;

    }

    else

    {

      if(refbus1.data.direction == 'from' || refbus1.data.direction == 'to&from'){

        var item1 = {bus:refbus1, gaptime:0, refstop:busstop, ref:false};

        // console.log(item1.bus.no);

        var end = refbus1.data.end;

        if(end < refbus1.data.start)

        {

          end = end+2400;

          if (time < refbus1.data.start)

          {

            time = time+2400;

          }

        }

        if(refbus1.data.start <= time && time < end)

        {

          checkDataList.push(item1);

        }

        else

        {

          // 버스 운영시간이 아닐때

          // console.log(refbus1.no + ' is not running');

        }

      }

    }

  }



  // refnode에서 버스 정보 조회

  for(var i = 0 ; i < busstop.pbus.length; i++)

  {

    var time = new Date().getHours()*100;

    var refbus2 = getBusIndex(busstop.pbus[i].no);

    if(refbus2 <= 0)

    {

      console.log(busstop.id + '에서 pbus:' + busstop.pbus[i] + '정보 찾기 오류');

      //return;

    }

    else

    {

      if(refbus2.data.direction == 'from' || refbus2.data.direction == 'to&from'){

        var item2 = {bus:refbus2, gaptime:busstop.pbus[i].gaptime, refstop:busstop, ref:true};

        var end = refbus2.data.end;

        if(end < refbus2.data.start)

        {

          end = end+2400;

          if (time < refbus2.data.start)

          {

            time = time+2400;

          }

        }

        if(refbus2.data.start <= time && time < end)

        {

          checkDataList.push(item2);

        }

        else

        {

          // 버스 운영시간이 아닐때

          // console.log(refbus2.no + ' is not running');

        }

      }

      }

  }

}



function putArrivalData(businfo, arrivaldata)

{

  // console.log(businfo);

  // console.log(arrivaldata);

  if(arrivaldata == null)

  {

    console.log('putArrivalData error :' + arrivaldata);

    return -1;

  }

  if(arrivaldata.data == null)

  {
    // 버스가 없는 시간대에는 해당 정류장의 id만 받아옴
    // putArrivalData.data error :{"id":"ICB164000377"}
    //console.log('putArrivalData.data error :' + JSON.stringify(arrivaldata));

    return -1;

  }

  arrivaldata = arrivaldata.data;

  // console.log('arrival data :  ' +JSON.stringify(arrivaldata));

  // console.log('bus info :  ' +JSON.stringify(businfo));

  for(var i = 0 ; i < arrivaldata.length; i++)

  {

    //console.log('arrivaldata[i].routeno : '+arrivaldata[i].routeno);

    //console.log('businfo.bus.no : '+businfo.bus.no);

    if(arrivaldata[i].routeno == '92(순환)'){

      arrivaldata[i].routeno = '92';

    }

    if(arrivaldata[i].routeno == businfo.bus.no)

    //console.log('arrivaldata[i].routeno // businfo.bus.no : '+arrivaldata[i].routeno +' // ' + businfo.bus.no);

    //console.log('businfo.bus.no : '+businfo.bus.no);

    {

      // console.log(businfo.refstop.name + ' = ' + arrivaldata[i].routeno + ' : ' + businfo.bus.no);

      // '곧 도착'일 경우 30초 남은것으로 가정



      if(arrivaldata[i].arrtime == '곧 도착'){

        var arrtime = 30 - businfo.gaptime;

        arrtime = Date.now() + arrtime*1000;

        var newArriveInfo = {

          no:businfo.bus.no,

          arrival:arrtime,

          start:businfo.bus.data.start,

          end:businfo.bus.data.end,

          interval:businfo.bus.data.interval,

          type:businfo.bus.data.type

        };

      } else {

        var arrtime = arrivaldata[i].arrtime - businfo.gaptime;

        arrtime = Date.now() + arrtime*1000;

        var newArriveInfo = {

          no:businfo.bus.no,

          arrival:arrtime,

          start:businfo.bus.data.start,

          end:businfo.bus.data.end,

          interval:businfo.bus.data.interval,

          type:businfo.bus.data.type

        };

      }



      var j;

      for(j = 0 ; j < arrivalInfo.length; j++)

      {

        if(arrivalInfo[j].name == businfo.refstop.name)

        {

          break;

        }

      }

      if(j == arrivalInfo.length)

      {

        arrivalInfo.push({name:businfo.refstop.name, data:[newArriveInfo]});

        console.log('new busstop added : \t' + businfo.refstop.name);

        console.log('arrival info added : \t' + businfo.refstop.name + ' : ' + newArriveInfo.no);

      }

      else

      {

        var k, duplicate = false;

        for(k = 0; k < arrivalInfo[j].data.length; k++)

        {

          if(arrivalInfo[j].data[k].no == newArriveInfo.no)

          {

            if(arrivalInfo[j].data[k].arrival < newArriveInfo.arrival)

            {

              arrivalInfo[j].data[k].arrival = newArriveInfo.arrival;

              console.log('arrival info updated : \t' +  businfo.refstop.name + ' : ' + newArriveInfo.no);

              break;

            }

            else

            {

              duplicate = true;

            }

          }

        }

        if(k == arrivalInfo[j].data.length && !duplicate)

        {

          arrivalInfo[j].data.push(newArriveInfo);

          console.log('arrival info added : \t' + businfo.refstop.name + ' : ' + newArriveInfo.no);

        }

      }

    }

  }

}



function parseBusData(busDatas)

{

  if(busDatas != null)

  {

    for(var k=0; k<busDatas.length; k++)

    {

      for(var i = 0; i < busDatas[k].data.length; i++)

      {

        for(var j = 0; j < checkDataList.length; j++)

        {

          if(checkDataList[j].ref)

          {

            // console.log(checkDataList[j].bus.data.refnode + ' : ' + busDatas[i].id);

            if(checkDataList[j].bus.data.refnode == busDatas[k].data[i].id)

            {

              // console.log('refnode detect');

              if(putArrivalData(checkDataList[j], busDatas[k].data[i]) == -1)

              {

                //console.log(JSON.stringify(checkDataList[j] + busDatas[k].data[i]));

              }

            }

          }

          else

          {

            // console.log(JSON.stringify(checkDataList[j]) + ' ' + busDatas[i].id);

            if(checkDataList[j].refstop.id == busDatas[k].data[i].id)

            {

              // console.log(checkDataList[j].refstop.id);

              if(putArrivalData(checkDataList[j], busDatas[k].data[i]) == -1)

              {

                //console.log(JSON.stringify(checkDataList[j] + busDatas[k].data[i]));

              }

            }

          }

        }

      }

    }
    for(var x = 0; x<arrivalInfo.length; x++){
      for(var x1 = 0; x1<arrivalInfo[x].data.length; x1++){
        for(var x2 = 0; x2<buses.length; x2++){
          if(buses[x2].no == arrivalInfo[x].data[x1].no){
            arrivalInfo[x].data[x1].type = buses[x2].data.type;
          }
        }
      }
    }
    //fs.writeFileSync('e.txt', JSON.stringify(arrivalInfo), 'utf8');
    storeData.busdata = arrivalInfo;

  }

  checkNodeList = [];

  checkDataList = [];

  seouldatas = [];

  datas = [];

}





function makeCheckNodeList(){

  var seoulnodes = [];

  var incheonnodes = [];

  for(var i = 0; i < checkDataList.length; i++)

  {

      if(checkDataList[i].bus.api == '서울특별시'){

        if(checkDataList[i].ref)

        {

          // 서울특별시 정류장조회는 숫자만 입력해야됨

          seoulnodes.push(fn(checkDataList[i].bus.data.refnode));

          //checkNodeList.push(checkDataList[i].bus.data.refnode);

        }

        else

        {

          seoulnodes.push(fn(checkDataList[i].refstop.id));

          //checkNodeList.push(checkDataList[i].refstop.id);

        }

      } else {

        if(checkDataList[i].ref)

        {

          incheonnodes.push(checkDataList[i].bus.data.refnode);

          //checkNodeList.push(checkDataList[i].bus.data.refnode);

        }

        else

        {

          incheonnodes.push(checkDataList[i].refstop.id);

          //checkNodeList.push(checkDataList[i].refstop.id);

        }

      }

  }// end for

  seoulnodes = Array.from(new Set(seoulnodes));

  incheonnodes = Array.from(new Set(incheonnodes));



  checkNodeList = [

    {api:'서울특별시', nodes:seoulnodes},

    {api:'국토교통부', nodes:incheonnodes}

  ];



  countIncheon = checkNodeList[1].nodes.length;

}





function getBusIndex(busno){

  for(var i = 0 ; i < buses.length; i++)

  {

    if(buses[i].no == busno)

    {

      return buses[i];

    }

  }

  return -1;

}


function addQueryCount(){

  var newDate = getCurrentDate();

  if(storeData.queryDate == newDate)
  {
    for(var i=0; i<3; i++){
      if(serviceKeyIncheon == serviceKeys[i]){
        storeData.querycountIncheon[i] += countIncheon + jnodes.length;
        storeData.currentquerycount.Incheon =  storeData.querycountIncheon[i];
      }

      if(serviceKeySeoul == serviceKeys[i]){
        storeData.querycountSeoul[i] += 3;
        storeData.currentquerycount.Seoul =  storeData.querycountSeoul[i];
      }
    }
  } else {
    storeData.queryDate = newDate;
    storeData.currentquerycount.Seoul = 0;
    storeData.currentquerycount.Incheon = 0;

    for(var i=0; i<3; i++){
      storeData.querycountIncheon[i] = 0;
      storeData.querycountSeoul[i] = 0;
    }

    for(var i=0; i<3; i++){
      if(serviceKeyIncheon == serviceKeys[i]){
        storeData.querycountIncheon[i] = countIncheon + jnodes.length;
        storeData.currentquerycount.Incheon =  storeData.querycountIncheon[i];
      }

      if(serviceKeySeoul == serviceKeys[i]){
        storeData.querycountSeoul[i] = 3;
        storeData.currentquerycount.Seoul =  storeData.querycountSeoul[i];
      }
    }
  }
}


// 보류
function getBusData()

{

  var incheondatas = [];

  var totaldata = [];

  var checkdate = 0;

  if(checkNodeList != null)

  {
    addQueryCount();

    for(var i =0; i < checkNodeList.length; i++)

    {

      for(var j=0; j<checkNodeList[i].nodes.length; j++){

        if(checkNodeList[i].api == '국토교통부'){

          var url = makeIncheonArrivialOption(checkNodeList[i].nodes[j]);

          var data = incheonbus(url);

          data = {id:checkNodeList[i].nodes[j], data:data};

          incheondatas.push(data);

        } else if(checkNodeList[i].api == '서울특별시'){

          if(datas.length == 0){

            var url = makeSeoulArrivialOption();

            seoulbus(url);

          }

          seoulbus2(checkNodeList[i].nodes[j]);



        }

      }

      //getHttp(checkNodeList[i], getReturn);

    }

    totaldata.push({id:'국토교통부', data:incheondatas});

    totaldata.push({id:'서울특별시', data:seouldatas});



  }

  return totaldata;

}






// 보류
function incheonbus(url){

  var item = [];

  try {

    var res = request('GET', 'http://' + url.host + url.path);
    //console.log('http://' + url.host + url.path);

    var json = JSON.parse(res.getBody('utf8'));

    var data;



    if(json.response.body.totalCount != 0)

    {

      if(json.response.body == undefined)

      {

        console.log(json);

      }

      else

      {

        item = json.response.body.items.item;

      }

    } else {

      return;

    }

  } catch (e) {

    console.log('incheonbus(url) request error : ' + e);

  }

  return item;

}






// 보류
function seoulbus(url){

    for(var i=0; i<buses.length; i++){

      if(buses[i].api == '서울특별시'){

        try{

          var res = request('GET', 'http://' +url.host + url.path + buses[i].routeid);

          var xmlToJson = convert.xml2json(res.getBody().toString(), {compact: true, spaces: 2}); // space는 하위 태그당 들여쓰기 수

          var json = JSON.parse(xmlToJson);

          var itemList = json.ServiceResult.msgBody.itemList;

          var data = {routeid:buses[i].routeid, data:itemList};

          datas.push(data);

        } catch (e) {

          console.log('seoulbus(url) request error : ' + e);

          return;

        }

      }

    }

}



// 추가된것(서울버스데이터) 보류
function seoulbus2(nodeId){

  nodeId = fn(nodeId);

  var time = getDateTime();

  var start = time.indexOf(" ")

  var end = time.indexOf(":");

  var list = time.substring(start+1, end);

  if(list >= 05 && list <= 23){

    var test1 = [];

    var test2 = [];

    for(var i=0; i<buses.length; i++){

      if(buses[i].api == '서울특별시'){

          //var data = fs.readFileSync('temp.txt', 'utf8');

          var json = datas;

          //var json = JSON.parse(data);

          for(var k=0; k<json.length; k++){

            // 서울버스와 같은 번호가 있는지 확인

            if(buses[i].routeid == json[k].routeid){

              var itemList = json[k].data;

              for(var j=0; j<itemList.length; j++){

                // 정류소 아이디와, 받아온 데이터에서 정류소 아이디와 같은게 있으면

                if(nodeId == itemList[j].stId._text){

                  var checknum = separation_time(itemList[j].arrmsg1._text);

                  if(checknum != '출발대기'){

                    var data = {

                        routeno: fn(itemList[j].rtNm._text),  // 버스번호

                        arrtime: checknum // 초로 환산한거

                    };

                    test1.push(data);

                  }

                }

              }

            }

          }

      }

    }

    if(test1.length != 0){

      test2 = {id:'ICB'+nodeId, data:test1};

      seouldatas.push(test2);

    }

  }

  //fs.writeFileSync('data3.txt', JSON.stringify(seouldatas), 'utf8');

}







// 버스 노선정보 검색
function getbusNodes(){

  for(var i=0; i<buses.length; i++){

    try {

      if(buses[i].api == '국토교통부'){

        var url = makebusNodes(buses[i].routeid);

      } else {

        var url = makebusNodes('ICB'+buses[i].routeid);

      }

      var res = request('GET', 'http://' + url.host + url.path);

      var json = JSON.parse(res.getBody('utf8'));

      if(res != null){

        if(json.response.body.totalCount != 0)

        {

          if(json.response.body == undefined)

          {

            console.log(json);

          }

          else

          {

            var arry = [];

            for(var j=0; j<json.response.body.totalCount; j++){

              var item = json.response.body.items.item;

              arry.push(item[j].nodenm);

            }

            if(buses[i].no == '92(순환)'){

              buses[i].no = '92';

            }

              var data = {

                no:buses[i].no,

                routeid:buses[i].routeid,

                nodelist:arry,

                turnnode:buses[i].data.turnnode,

                start: buses[i].data.start,

            		end: buses[i].data.end,

                type: buses[i].data.type

              };

            busNodes.push(data);

          }

        }

      }

    } catch (e) {

      console.log('getbusNodes() request error : ' + e);

      return;

    }

  }

}



// 인입 조회
function parseInuEntrance(){

  var url = makeIncheonArrivialOption(jnodes[3]);

  try {

    var res = request('GET', 'http://' + url.host + url.path);

    var json = JSON.parse(res.getBody('utf8'));

    var data;

    if(json.response.body.totalCount != 0)

    {

      if(json.response.body == undefined)

      {

        console.log(json);
        return;

      }

      else

      {

        var temp = [];

        var item = json.response.body.items.item;

        for(var j=0; j<item.length; j++){

            // 처음에 데이터 넣고 그 다음부터 전것과 비교

            for(var k=0; k<buses.length; k++){

              if(item[j].routeno == '92(순환)'){

                item[j].routeno = '92'

              }

              if(item[j].routeno == buses[k].no){

                  if(j<1){

                    var unit = {

                      no: (item[j].routeno).toString(),

                      arrival: Date.now() + item[j].arrtime*1000,

                      start: buses[k].data.start,

                      end: buses[k].data.end,

                      interval: buses[k].data.interval,

                      type: buses[k].data.type

                    }

                    temp.push(unit);

                    // j=1부터

                  } else {

                    // 번호가 다를 경우 추가

                    if(item[j].routeno != item[j-1].routeno){

                      check = 0;

                      // 6-2일경우

                      // check가 0일경우 그대로 추가

                      // check가 1이면 추가 안함

                      if(item[j].routeno == '6-2'){

                       check = checkBus6_2(item[j]);

                      }

                      if(check == 0){

                        var unit = {

                          no: (item[j].routeno).toString(),

                          arrival: Date.now() + item[j].arrtime*1000,

                          start: buses[k].data.start,

                          end: buses[k].data.end,

                          interval: buses[k].data.interval,

                          type: buses[k].data.type

                        }

                        temp.push(unit);

                      }

                      // 번호가 같은 경우

                    } else if(item[j].routeno == item[j-1].routeno) {

                      //console.log('item[j].routeno == item[j-1].routeno :'+item[j].routeno+', // '+item[j-1].routeno);

                      //번호가 같은경우 arrtime이 더 짧은거 추가

                        check = 0;

                        // 6-2일경우 지정단을 2번 거침

                        // check가 0일경우 그대로 추가, check가 1이면 추가 안함

                        // 정류장의 순서가 35번째가 되는 차량이 인천대까지 가는 차량

                        if(item[j].routeno == '6-2'){

                         check = checkBus6_2(item[j]);

                        }



                        if(check == 0){

                          if(item[j].arrtime < item[j-1].arrtime){

                            //console.log('item[j].arrtime < item[j-1].arrtime :'+item[j].arrtime+', // '+item[j-1].arrtime);

                            temp.pop();

                            var unit = {

                              no: (item[j].routeno).toString(),

                              arrival: Date.now() + item[j].arrtime*1000,

                              start: buses[k].data.start,

                              end: buses[k].data.end,

                              interval: buses[k].data.interval,

                              type: buses[k].data.type

                            }



                            temp.push(unit);

                          }

                        }

                    }

                  }





              }

            }

        }

        data = {id:jnodes[3], data:temp};

        jijeongdandata.push(data);

      }

    }

  } catch (e) {

    console.log('parseInuEntrance() request error : ' + e);

    return;

  }

}


// 지정단 2,3,4번출구 조회
function parseJijeongdan(){

  for(var i =0; i < jnodes.length-1; i++)

  {

    var url = makeIncheonArrivialOption(jnodes[i]);

    try {

      var res = request('GET', 'http://' + url.host + url.path);

      var json = JSON.parse(res.getBody('utf8'));

      var data;

      if(json.response.body.totalCount != 0)

      {

        if(json.response.body == undefined)

        {

          console.log(json);

        }

        else

        {
          jijeongdandata = [];

          var temp = [];

          var item = json.response.body.items.item;

          for(var j=0; j<item.length; j++){

              // 처음에 데이터 넣고 그 다음부터 전것과 비교

              for(var k=0; k<buses.length; k++){

                if(item[j].routeno == '92(순환)'){

                  item[j].routeno = '92'

                }

                if(item[j].routeno == buses[k].no){

                  if(buses[k].data.exit == jnodes[i]){

                    if(j<1){

                      var unit = {

                        no: (item[j].routeno).toString(),

                        arrival: Date.now() + item[j].arrtime*1000,

                        start: buses[k].data.start,

                        end: buses[k].data.end,

                        interval: buses[k].data.interval,

                        type: buses[k].data.type

                      }

                      temp.push(unit);

                      // j=1부터

                    } else {

                      // 번호가 다를 경우 추가

                      if(item[j].routeno != item[j-1].routeno){

                        check = 0;

                        // 6-2일경우

                        // check가 0일경우 그대로 추가

                        // check가 1이면 추가 안함

                        if(item[j].routeno == '6-2'){

                         check = checkBus6_2(item[j]);

                        }

                        if(check == 0){

                          var unit = {

                            no: (item[j].routeno).toString(),

                            arrival: Date.now() + item[j].arrtime*1000,

                            start: buses[k].data.start,

                            end: buses[k].data.end,

                            interval: buses[k].data.interval,

                            type: buses[k].data.type

                          }

                          temp.push(unit);

                        }

                        // 번호가 같은 경우

                      } else if(item[j].routeno == item[j-1].routeno) {

                        //console.log('item[j].routeno == item[j-1].routeno :'+item[j].routeno+', // '+item[j-1].routeno);

                        //번호가 같은경우 arrtime이 더 짧은거 추가

                          check = 0;

                          // 6-2일경우 지정단을 2번 거침

                          // check가 0일경우 그대로 추가, check가 1이면 추가 안함

                          // 정류장의 순서가 35번째가 되는 차량이 인천대까지 가는 차량

                          if(item[j].routeno == '6-2'){

                           check = checkBus6_2(item[j]);

                          }



                          if(check == 0){

                            if(item[j].arrtime < item[j-1].arrtime){

                              temp.pop();

                              var unit = {

                                no: (item[j].routeno).toString(),

                                arrival: Date.now() + item[j].arrtime*1000,

                                start: buses[k].data.start,

                                end: buses[k].data.end,

                                interval: buses[k].data.interval,

                                type: buses[k].data.type

                              }

                              temp.push(unit);

                            }

                          }

                      }

                    }

                  }

                }

              }

          }

          data = {id:jnodes[i], data:temp};

          jijeongdandata.push(data);

        }

      } else {
        return;
      }

    } catch (e) {

      console.log('parseJijeongdan() request error : ' + e);

    }

  }

  parseInuEntrance();

}


// 지정단을 지나가는 6-2번버스가 학교방향인지 판단
function checkBus6_2(item){

  // 지정단을 조회했을때 <arrprevstationcnt>와 <nodeord> 합이 대략 34~35 사이일 경우에만 6-2번버스를 나타냄
  //http://openapi.tago.go.kr/openapi/service/BusLcInfoInqireService/getRouteAcctoBusLcList?serviceKey=e7pMmKrfUCGgvjoHgMd9ZP1Imd03O%2BlHNBqMDn4CHk9%2BeTkWAx0WdPXXP%2FzrqNW2tiXC8xFhtJUOAt%2FtovxrKg%3D%3D&cityCode=23&routeId=ICB165000393&_type=json
  var url = checkLeftNode();

  try {

    var check = 1;

    var res = request('GET', 'http://' + url.host + url.path);
    //console.log('http://' + url.host + url.path);

    var json = JSON.parse(res.getBody('utf8'));

    var item2 = json.response.body.items.item;

    for(var i=0; i<item2.length; i++){

      var node_sum = item2[i].nodeord + item.arrprevstationcnt;

      if(node_sum >= 34 && node_sum <= 35){

        check = 0;

      }

    }

  } catch (e) {

    console.log('checkBus6_2(item) request error : ' + e);

    return;

  }

  return check;

}


// 6-2번버스의 남은 정류장 수 확인(6-2번이 지정단을 2번 지나가기 때문에 남은 정류장수를 계산하여 학교방향버스인지 판단)
function checkLeftNode()

{

  var options = {

    host: 'openapi.tago.go.kr',

    port: 80,

    path: leftnodePath +

    '?serviceKey=' + serviceKeyIncheon2 +

    '&cityCode=' + cityCode +

    '&routeId=ICB165000393' +

    '&_type=json',

    method: 'GET'

  };

  return options;

}


// 버스 정류장정보 url 생성 후 반환
function makebusNodes(routeId)

{

  var options = {

    host: 'openapi.tago.go.kr',

    port: 80,

    path: busnodePath +

    '?serviceKey=' + serviceKeyIncheon +

    '&numOfRows=300' +

    '&pageNo=1' +

    '&cityCode=' + cityCode +

    '&routeId=' + routeId +

    '&_type=json',

    method: 'GET'

  }

  return options;

}


// 인천버스 도창정보 url 생성 후 반환
function makeIncheonArrivialOption(nodeId)

{

  var options = {

    host: 'openapi.tago.go.kr',

    port: 80,

    path: arrivalinfoPath +

    '?serviceKey=' + serviceKeyIncheon +

    '&cityCode=' + cityCode +

    '&nodeId=' + nodeId +

    '&numOfRows=200&_type=json',

    method: 'GET'

  };

  return options;

}


// 서울버스 도착정보 url 생성 후 반환
function makeSeoulArrivialOption(nodeId)

{

  var options = {

    host: 'ws.bus.go.kr',

    port: 80,

    path: seoulbusPath +

    '?serviceKey=' + serviceKeySeoul +

    '&busRouteId=',

    method: 'GET'

  };

  return options;

}


// 현재 날짜(년, 달, 일, 시간, 분, 초) 반환
function getDateTime()

{

  var date = new Date();

  var hour = date.getHours();

  var min  = date.getMinutes();

  var sec  = date.getSeconds();

  var year = date.getFullYear();

  var month = date.getMonth() + 1;

  var day  = date.getDate();


  hour = (hour < 10 ? "0" : "") + hour;

  min = (min < 10 ? "0" : "") + min;

  sec = (sec < 10 ? "0" : "") + sec;

  month = (month < 10 ? "0" : "") + month;

  day = (day < 10 ? "0" : "") + day;

  return year + "." + month + "." + day + " " + hour + ":" + min + ":" + sec;

}




// 현재 날짜(년, 달, 일) 반환
function getCurrentDate(){

  var date = new Date();

  var year = date.getFullYear();

  var month = date.getMonth() + 1;

  var day  = date.getDate();

  return ''+year+'.'+month+'.'+day;

}


// 서울버스의 남은시간을 받아서 초로 변환하여 반환
function separation_time(sentence){

  if(sentence == '출발대기'){

    return '출발대기';

  } else if(sentence == '곧 도착'){

    return '곧 도착';

  } else{

    var end = sentence.indexOf('분');

    var list = sentence.substring(0, end);

    var start2 = sentence.indexOf('분');

    var end2 = sentence.indexOf('초');

    var list2 = sentence.substring(start2+1, end2);

    return parseInt(list*60) + parseInt(list2);

  }

}





// 문자열을 받아서 숫자만 추려낸 뒤 반환
function fn(str){

    var res;

    res = str.replace(/[^0-9]/g,"");

    return res;

}







app.get('/arrivalinfoFrom', function(req, res)

{

  res.send(arrivalInfo);

  console.log(req.ip + ' connected');

}

);



app.get('/arrivalinfoTo', function(req, res)

{

  res.send(jijeongdandata);

  console.log(req.ip + ' connected');

}

);





app.get(['/getNodes/:no', '/getNodes'], function(req, res){

  var no = req.params.no;

  if(no){

    for(var i=0; i<busNodes.length ;i++){

      if(no == busNodes[i].no){

        res.send(busNodes[i]);

      }

    }

  } else {

    res.send(busNodes);

  }

});





app.post('/errormsg', function(req, res){

  var title = req.body.title;

  var msg = req.body.msg;

  var contact = req.body.contact;

  var device = req.body.device;

  if(!title){

    title = " ";

  }

  if(!msg){

    msg = " ";

  }

  if(!contact){

    contact = " ";

  }

  if(!device){

    device = " ";

  }

  var pool = mysql.createPool(config.MYSQL_CONFIG);

  pool.getConnection(function(err, connection){

    if(err){

      console.log(err);

      res.status(404).send("DB_ERROR");

    }

    else {

      connection.query("insert into question set?", {title:title, msg:msg, contact:contact, device:device},

      function(err, results){

          if(!err){

            res.status(200).send("SUCCESS");

          }

          else {

            console.log(err);

            res.status(404).send("DB_QUERY_ERROR");

          }

      });

    }

  });

});



const server = app.listen(port, function()

{

  console.log(`Server running at ${port}`);

}

);
