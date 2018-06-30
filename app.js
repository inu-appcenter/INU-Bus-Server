const express = require('express');
const app = express();
const http = require('http');
const fs = require('fs');
const mysql  = require('mysql');
// const _ = require('underscore');
// http request로 받은 값을 사용해야 해서 async방식의 http.request대신, sync-request를 사용한다.
const request = require('sync-request');

const bodyParser = require('body-parser');

// 쿼리 사용량과 서버 종료 직전까지의 정보를 저장해둠.
const dataStoreName = "stored.txt";

// API 변수 선언.
const config = require('./config.js');
const port = config.PORT;
// 서비스 계정 두개 필요
const serviceKey1 = config.INCHEON_BUS_KEY;
const cityCode = '23';  // 인천
const arrivalinfoPath = '/openapi/service/ArvlInfoInqireService/getSttnAcctoArvlPrearngeInfoList';    // 버스 도착정보 path

var storeData = {
  queryCount:0,
  queryDate:'',
  busdata:''
};


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

// 참조할 버스들 기본 정보
const buses = [
  {no:'8',      routeid:'ICB165000012', api:'국토교통부',  data: { refnode:'ICB164000396', start:505, end:2306, interval:8 , type:'간선' }},
  {no:'780',    routeid:'ICB165000169', api:'국토교통부',  data: { refnode:'ICB164000396', start:500, end:2250, interval:20, type:'간선' }},
  {no:'780-1',  routeid:'ICB165000225', api:'국토교통부',  data: { refnode:'ICB164000396', start:500, end:2300, interval:20, type:'간선' }},
  {no:'780-2',  routeid:'ICB165000388', api:'국토교통부',  data: { refnode:'ICB164000396', start:500, end:2320, interval:25, type:'간선' }},
  {no:'908',    routeid:'ICB165000244', api:'국토교통부',  data: { refnode:'ICB164000396', start:500, end:2300, interval:20, type:'간선급행' }},
  {no:'909',    routeid:'ICB165000193', api:'국토교통부',  data: { refnode:'ICB164000396', start:430, end:2330, interval:20, type:'간선급행' }},
  {no:'6',      routeid:'ICB165000007', api:'국토교통부',  data: { refnode:'ICB164000380', start:500, end:2300, interval:14, type:'간선' }},
  {no:'6-1',    routeid:'ICB165000008', api:'국토교통부',  data: { refnode:'ICB164000404', start:500, end:2300, interval:15, type:'간선' }},
  // {no:'6-3',    routeid:'?', api:'국토교통부',  data: { refnode:'?', start:?, end:?, interval:?, type:'간선' }},
  // {no:'M6405',  routeid:'165000215',    api:'서울특별시',  data: { refnode:'', start:500, end:2300, interval:16, type:'광역급행' }},
  // {no:'1301',   routeid:'165000150',    api:'서울특별시',  data: { refnode:'ICB164000368', start:500, end:2300, interval:30, type:'광역' }},
  // {no:'3002',   routeid:'213000019',    api:'서울특별시',  data: { refnode:'', start:530, end:2320, interval:35, type:'광역' }},
  {no:'16',     routeid:'ICB165000020', api:'국토교통부',  data: { refnode:'', start:530, end:30, interval:25, type:'간선' }},
  {no:'81',     routeid:'ICB165000442', api:'국토교통부',  data: { refnode:'', start:530, end:30, interval:25, type:'간선' }},
  {no:'82',     routeid:'ICB165000443', api:'국토교통부',  data: { refnode:'', start:530, end:30, interval:25, type:'간선' }}

];

// 각 정류장에 대한 데이터 정의 busstop으로 통칭.
var FRONTGATE = {
  name:'frontgate',
  id:'ICB164000385',  // API용 정류장 id
  pbus: [
    {no:'8',      gaptime:60},
    {no:'908',    gaptime:60},
    {no:'909',    gaptime:60},
    {no:'780',    gaptime:60},
    {no:'780-1',  gaptime:60},
    {no:'780-2',  gaptime:60}
  ], // 따로 검색해야하는 문제 버스.
  nbus: ['16', '81', '82', '3002']  // 해당 정류장 검색으로 정상적으로 나오는 일반 버스.
};
var SCIENCE = {
  name:'science',
  id:'ICB164000378',
  pbus: [
    {no:'6',      gaptime:120},
    {no:'6-1',    gaptime:120},
    // {no:'92',  gaptime:120},
    {no:'8',      gaptime:120},
    {no:'908',    gaptime:120},
    {no:'909',    gaptime:120},
    {no:'780',    gaptime:120},
    {no:'780-1',  gaptime:120},
    {no:'780-2',  gaptime:120}
  ],
  nbus: ['3002']
};
var ENGINEER = {
  name:'engineer',
  id:'ICB164000377',
  pbus: [
    {no:'6',      gaptime:180},
    {no:'6-1',    gaptime:180},
    // {no:'92',  gaptime:180},
    {no:'8',      gaptime:180},
    {no:'908',    gaptime:180},
    {no:'909',    gaptime:108},
    {no:'780',    gaptime:108},
    {no:'780-1',  gaptime:180},
    {no:'780-2',  gaptime:180}
  ],
  nbus: ['3002']
};

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

// --------------------- 함수 정의 -------------------------------

function loadStoredData()
{
    try {
      var date = new Date();
      var data = fs.readFileSync(dataStoreName, 'utf8');
      if(data == null) return;
      data = JSON.parse(data);
      console.log(data);
      if(data.queryDate === getCurrentDate())
      {
        storeData.queryCount = parseInt(data.queryCount,10);
        storeData.queryDate = data.queryDate;
        // TODO 저장된 버스 정보도 허용 시간 범위내에서 로드 하도록.
      }
      else
      {
        storeData.queryCount = 0;
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

// 정류장 정보에서 checkNodeList를 만든다. 중복 배제
function putCheckDataList(busstop){
  // 일반적인 버스 정보 조회
  for(let i = 0 ; i < busstop.nbus.length; i++)
  {
    let time = new Date().getHours()*100;
    let refbus1 = getBusIndex(busstop.nbus[i]);
    if(refbus1 <= 0)
    {
      console.log(busstop.id + '에서 nbus ' + i + '번째 정보 찾기 오류');
      console.log(busstop.nbus);
      //return;
    }
    else
    {
      let item1 = {bus:refbus1, gaptime:0, refstop:busstop, ref:false};
      // console.log(item1.bus.no);
      let end = refbus1.data.end;
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

  // refnode에서 버스 정보 조회
  for(let i = 0 ; i < busstop.pbus.length; i++)
  {
    let time = new Date().getHours()*100;
    let refbus2 = getBusIndex(busstop.pbus[i].no);
    if(refbus2 <= 0)
    {
      console.log(busstop.id + '에서 pbus:' + busstop.pbus[i] + '정보 찾기 오류');
      //return;
    }
    else
    {
      let item2 = {bus:refbus2, gaptime:busstop.pbus[i].gaptime, refstop:busstop, ref:true};
      let end = refbus2.data.end;
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

function makeCheckNodeList(){
  for(var i = 0; i < checkDataList.length; i++)
  {
    if(checkDataList[i].ref)
    {
      checkNodeList.push(checkDataList[i].bus.data.refnode);
    }
    else
    {
      checkNodeList.push(checkDataList[i].refstop.id);
    }
  }
  checkNodeList = Array.from(new Set(checkNodeList));
}

function makeArrivialOption(nodeId)
{
  var options = {
    host: 'openapi.tago.go.kr',
    port: 80,
    path: arrivalinfoPath +
    '?serviceKey=' + serviceKey1 +
    '&cityCode=' + cityCode +
    '&nodeId=' + nodeId +
    '&numOfRows=200&_type=json',
    method: 'GET'
  };

  return options;
}

function getBusData()
{
  var datas = [];
  if(checkNodeList != null)
  {
    var newDate = getCurrentDate();
    if(storeData.queryDate === newDate)
    {
      storeData.queryCount += checkNodeList.length;
    }
    else
    {
      storeData.queryCount = checkNodeList.length;
      storeData.queryDate = newDate;
    }

    for(var i =0; i < checkNodeList.length; i++)
    {
      //getHttp(checkNodeList[i], getReturn);
      var url = makeArrivialOption(checkNodeList[i]);
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
            json = json.response.body.items.item;
            data = {id:checkNodeList[i], data:json};
            datas.push(data);
          }
        }
      } catch (e) {
        console.log('request error : ' + e);
        return;
      }
    }
  }
  return datas;
}

// 도착정보를 각 정류장에 맞게 추가한다.
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
    console.log('putArrivalData.data error :' + arrivaldata);
    return -1;
  }
  arrivaldata = arrivaldata.data;
  // console.log(JSON.stringify(arrivaldata));
  // console.log(JSON.stringify(businfo));
  for(var i = 0 ; i < arrivaldata.length; i++)
  {
    if(arrivaldata[i].routeno == businfo.bus.no)
    {
      // console.log(businfo.refstop.name + ' = ' + arrivaldata[i].routeno + ' : ' + businfo.bus.no);
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

// 통째로 넘어오는 버스 데이터를 checkDataList를 확인하여 각 요청별로 나누어준다.
function parseBusData(busDatas)
{
  if(busDatas != null)
  {
    for(var i = 0; i < busDatas.length; i++)
    {
      for(var j = 0; j < checkDataList.length; j++)
      {
        if(checkDataList[j].ref)
        {
          // console.log(checkDataList[j].bus.data.refnode + ' : ' + busDatas[i].id);
          if(checkDataList[j].bus.data.refnode == busDatas[i].id)
          {
            // console.log('refnode detect');
            if(putArrivalData(checkDataList[j], busDatas[i]) == -1)
            {
              console.log(checkDataList[j] + busDatas[i]);
            }
          }
        }
        else
        {
          // console.log(JSON.stringify(checkDataList[j]) + ' ' + busDatas[i].id);
          if(checkDataList[j].refstop.id == busDatas[i].id)
          {
            // console.log(checkDataList[j].refstop.id);
            if(putArrivalData(checkDataList[j], busDatas[i]) == -1)
            {
              console.log(checkDataList[j] + busDatas[i]);
            }
          }
        }
      }
    }
    storeData.busdata = arrivalInfo;
  }
  checkNodeList = [];
  checkDataList = [];
}

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

// ex) 2017.09.09
function getCurrentDate(){
  var date = new Date();
  var year = date.getFullYear();
  var month = date.getMonth() + 1;
  var day  = date.getDate();

  return ''+year+'.'+month+'.'+day;
}

// 반복 수행할 서버 작업
function mainprocess()
{
  putCheckDataList(FRONTGATE);
  putCheckDataList(SCIENCE);
  putCheckDataList(ENGINEER);
  makeCheckNodeList();
  totaldata = getBusData();
  // console.log(JSON.stringify(checkDataList));
  // console.log(JSON.stringify(checkNodeList));
  // console.log(JSON.stringify(totaldata));
  parseBusData(totaldata);
  fs.writeFileSync(dataStoreName, JSON.stringify(storeData), 'utf8');
  console.log('updated at ' + getDateTime());
  console.log('query used : '+storeData.queryCount);
  // console.log(storeData);
  // console.log('currenet : ' + JSON.stringify(arrivalInfo, null, '\t'));
}

//---------------- 함수 정의 끝-------------------
// ------------------서버 시작-------------------

loadStoredData();
mainprocess();

setInterval(function()
{
  mainprocess();
},
30000);

app.get('/arrivalinfo', function(req, res)
{
  res.send(arrivalInfo);
  console.log(req.ip + ' connected');
}
);

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
