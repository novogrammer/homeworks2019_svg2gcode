const fs=require("fs");
const {
  SVGPathData,
  SVGPathDataTransformer,
  SVGPathDataEncoder,
  SVGPathDataParser,
}=require("svg-pathdata");
const {JSDOM}=require("jsdom");

const dom=new JSDOM("");
const $=require("jquery")(dom.window);


//M L Cだけか確認する関数
function validatePathData(pathData){
  for(let command of pathData.commands){
    switch(command.type){
      case SVGPathData.MOVE_TO:
      case SVGPathData.LINE_TO:
      case SVGPathData.CURVE_TO:
      //DO NOTHING
      break;
      default:
      console.error("unexpected command type:"+command.type);
      process.exit(1);
      break;
    }
  }
}


function lerp(a,b,t){
  return a*(1-t)+b*t;
}
function lerpPoint(a,b,t){
  let x=lerp(a.x,b.x,t);
  let y=lerp(a.y,b.y,t);
  return {x,y};
}
function getBezierPoint(p0,p1,p2,p3,t){
  let p4=lerpPoint(p0,p1,t);
  let p5=lerpPoint(p1,p2,t);
  let p6=lerpPoint(p2,p3,t);
  
  let p7=lerpPoint(p4,p5,t);
  let p8=lerpPoint(p5,p6,t);
  
  let p9=lerpPoint(p7,p8,t);
  return p9;
}




function showUsageAndExit(){
  const path = require('path');
  const basename = path.basename(process.argv[1]);
  console.error(`Usage: node ${basename} <input_svg_file> <output_gcode_file>`);
  process.exit(1);
}

function convertSvgPathDataToGcodeCommands(svgPathData){
  //扱いやすいように M L Cだけにする
  let pathData=svgPathData.toAbs()
  .normalizeHVZ()//normalize h v z
  .normalizeST()
  .aToC()
  .qtToC()
  ;
  validatePathData(pathData);

  
  //TODO
  //console.log(gcodeCommands.join("\n"));

  const BEZIER_POINT_QTY=10;

  //http://www.nttd-es.co.jp/products/e-learning/e-trainer/trial/nc/g-code.htm
  const F="60";
  let gcodeCommands=[];
  let previousCommand=null;
  for(let command of pathData.commands){
      switch(command.type){
        case SVGPathData.MOVE_TO:
        gcodeCommands.push("G00 X"+command.x+" Y"+command.y);
        break;
        case SVGPathData.LINE_TO:
        gcodeCommands.push("G01 X"+command.x+" Y"+command.y+" F"+F);
        break;
        case SVGPathData.CURVE_TO:
        for(let i=0;i<BEZIER_POINT_QTY;++i){
          let t=(i+1)/BEZIER_POINT_QTY;
          let p0={x:previousCommand.x,y:previousCommand.y};
          let p1={x:command.x1,y:command.y1};
          let p2={x:command.x2,y:command.y2};
          let p3={x:command.x,y:command.y};
          let p=getBezierPoint(p0,p1,p2,p3,t);
          gcodeCommands.push("G01 X"+p.x+" Y"+p.y+" F"+F);
        }
        break;
        default:
        //DO NOTHING
        break;
    }
    previousCommand=command;
  }
  
  return gcodeCommands;
  
}


function convertSvgToGcode(svgPath,gcodePath){
  let svg=fs.readFileSync(svgPath,"utf8");
  let $svg=$(svg);

  //いくつかあるpathタグのdを空白で結合する
  let path=$svg.find("path").toArray().map((e)=>$(e).attr("d")).join(" ");
  let pathDataOriginal=new SVGPathData(path);
  let gcodeCommands=convertSvgPathDataToGcodeCommands(pathDataOriginal);
  
  fs.writeFileSync(gcodePath,gcodeCommands.join("\n"));
}


if(require.main === module) {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    showUsageAndExit();
  }
  convertSvgToGcode(args[0],args[1]);
  
  
}