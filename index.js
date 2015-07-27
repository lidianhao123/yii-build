var fs = require('fs'),
    pth = require('path'),
    type = "", //build 类型 debug or release
    crypto = require('crypto'),
    iconv = require('iconv-lite'),
    util = require('util'),
    uglifyjs = require('uglifyjs'),
    cleancss = require('clean-css'),
    conf, fileList, yii, jsFileList;

//数据格式转换 "test.php":["1.js", "2.js"]  -> "1.js":["test.php"], "2.js":["test.hp"]
function formData(data){
    var fl = {};
    if(yii.util.is(data, 'Object') && data.js) {
        yii.util.map(data.js, function(key, value){
            if(util.isArray(value)){
                value.forEach(function(ele){
                    var filePath = "static/" + ele;
                    if(!fl[filePath]){
                        fl[filePath] = [];
                    }
                    fl[filePath].push(key);
                })
            }
        });
        return fl;
    }
}

function findRelated(arrStrList, path){
    var mapObj = {};

    if(!util.isArray(arrStrList) || arrStrList.length === 0){
        return mapObj;
    }

    // function recursiveReadFile(fileName){
    //     if(!yii.util.exists(fileName)) return;

    //     if(yii.util.isFile(fileName)){
    //         check(fileName);
    //     }

    //     if(yii.util.isDir(fileName) && fileName != ".svn"){
    //         var files = fs.readdirSync(fileName);
    //         files.forEach(function(val,key){
    //             var temp = pth.join(fileName,val);
    //             if (yii.util.isDir(temp)) recursiveReadFile(temp);
    //             if (yii.util.isFile(temp)) check(temp, val);
    //         })
    //     }
    // }

    function check(fileName){
        var data = yii.util.read(fileName);
        arrStrList.forEach(function(ele){
            ele = ele.replace(".js", "");
            var exc = new RegExp("\/" + ele + "\.js|\/" + ele + "\_","i");
            if(exc.test(data)){
                if(!mapObj[fileName]){
                    mapObj[fileName] = [];
                }
                mapObj[fileName].push(ele + ".js");
            }
        });
    }

    // recursiveReadFile(path);
    yii.util.recursiveFile(path, check);

    return mapObj;
}

//此方法只能匹配在<script src = "static/modules/common.js"></script>中的js文件路径并进行替换
function analyzePhp1(content, jsFileNameList, path) {
    var reg =
        /(<script(?:(?=\s)[\s\S]*?["'\s\w\/]>|>))[\s\S]*?(?:<\/script\s*>)\s*/ig;
    var result;
    /*代码逻辑，1.先匹配出<script ...></script>
                2.匹配出src = " ..... "，然后匹配"/"到结束处的字符串 tmp[0] = 待对比的路径内容
                3.for循环jsFileNameList,依次查询是否为对应文件，是的话进行替换
    */
    var replaced = content.replace(reg, function (m) {
        //$1为script标签
        result = m.match(/(?:\ssrc\s*=\s*)(?:'([^']+)'|"([^"]+)"|[^\s\/>]+)/i);
        if(result){
            var tmp = result[1] || result[2];
            tmp = tmp.match(/(\/[\s\S]*?)$/i);
            for(var i = 0; i < jsFileNameList.length; i++) {
                var fn = jsFileNameList[i].match(/([\s\S]*?)(?=\_|\.)/i);
                fn = fn[1];
                var exc = new RegExp("\/" + fn);
                if(exc.test(tmp[0])){
                    var newTmp = path + "/" + jsFileNameList[i];
                    if(newTmp.indexOf("/") > 0){
                        newTmp = "/" + newTmp;
                    }
                    m = m.replace(tmp[0], newTmp);
                    break;
                }
            }
        }
        return m;
    });

    return replaced;
}
/*
*   analyzePhp2
*   此版本函数可以匹配文件中"js/modules/common.js"或"js/modules/common_213dfadsfa.js"
*   替换成 rpPath+filename
*   content ： string 
*   jsFileNameList ： 目标字符串数组
*   rpPath  ：目标替换前缀字符串
*   srcPath1/srcPath2 : 用于查询的前缀字符串
*   说明此方法需要调用jsFileNameList.length次content.replace，一次jsFileNameList.forEach
*/
function analyzePhp2(content, jsFileNameList, rpPath, srcPath1, srcPath2) {
    //为路径添加后缀"/"
    rpPath = yii.util.addLastSlash(rpPath);
    srcPath1 = yii.util.addLastSlash(srcPath1);
    srcPath2 = yii.util.addLastSlash(srcPath2);
    //先生成文件对应的匹配正则表达式，然后对content进行replace, 单次完成后继续下一文件的。
    jsFileNameList.forEach(function(ele){
        var math = ele.match(/(?:([\s\S]*)\_|([\s\S]*)\.)/i),
            regStr = "";

        math = math[1] || math[2];

        regStr = "(?:" + srcPath2 + math + "(?:\.js|\\_[\\s\\S]*?\.js)|";
        regStr = regStr + srcPath1 + math + "(?:\.js|\\_[\\s\\S]*?\.js))";

        content = content.replace(new RegExp(regStr, "ig"), rpPath + ele);

    });

    return content;
}
/*
*   analyzePhp2
*   此版本函数可以匹配文件中"js/modules/common.js"或"js/modules/common_213dfadsfa.js"
*   替换成 rpPath+filename
*   content ： string 
*   jsFileNameList ： 目标字符串数组
*   rpPath  ：目标替换前缀字符串
*   srcPath1/srcPath2 : 用于查询的前缀字符串
*   说明此方法只需要调用1次content.replace，两次jsFileNameList.forEach
*/
function analyzePhp3(content, jsFileNameList, rpPath, srcPath1, srcPath2) {

    var regStr = "";
    //为路径添加后缀"/"
    rpPath = yii.util.addLastSlash(rpPath);
    srcPath1 = yii.util.addLastSlash(srcPath1);
    srcPath2 = yii.util.addLastSlash(srcPath2);

    //先生成正则规则每个文件名对应一个匹配子串正则
    jsFileNameList.forEach(function(ele){
        var math = ele.match(/([\s\S]*?)(?=\_|\.)/i),
            math = math[1];

        regStr = regStr + "(" + srcPath2 + math + "(?:\.js|\\_[\\s\\S]*?\.js)|" + srcPath1 + math + "(?:\.js|\\_[\\s\\S]*?\.js))|";
    });

    regStr = regStr.substring(0, regStr.length - 1);

    content = content.replace(new RegExp(regStr, "ig"), function(){
        var reStr = "";
            arr = Array.prototype.slice.call(arguments);
        //文件数组中某一文件的index 对应 匹配返回的arguments[index + 1]，如果该匹配不为undefined则需要替换，返回替换值
        jsFileNameList.forEach(function(ele, index){
            if(arr[index + 1]){
                reStr = rpPath + ele;
            }
        });
        return reStr;
    })

    return content;
}

function compressJs(src, dest){
    var map = {};

    if(yii.util.isDir(src)){
        if(!yii.util.isDir(dest)){
            yii.util.mkdir(dest);
        }
        var files = fs.readdirSync(src);
        files.forEach(function(val){
            var temp = pth.join(src, val);
            if (yii.util.isFile(temp)) {
                console.info(yii.util.getTime() + " start compress and make md5 " + temp + " file");
                var result = uglifyjs.minify(yii.util.read(temp), {fromString: true}),
                    md5 = yii.util.md5(result.code),
                    newName = val.replace(".js", "_" + md5 + ".js");

                map[val] = newName;
                var tmp = pth.join(dest, newName);
                if(!yii.util.exists(tmp)){
                    yii.util.write(tmp, result.code);
                }
            }
        })
    }

    return map;
}

function build(type){
    console.info(yii.util.getTime() + " start build");
    var destPath = "",
        jsMap = {};//release : {"common.js":"common_12adsfasd.js"}

    if(type === "debug"){
        console.info("yii build debug type");

        destPath = conf.jsSrc;

    } else if(type === "release") {
        console.info("yii build release type");

        jsMap = compressJs(conf.jsSrc, conf.jsDest);
        destPath = conf.jsDest;

    } else{
        console.info("enter command error");
        return; 
    }

    console.info(yii.util.getTime() + " complete compress all javascript files ");

    yii.util.map(conf.js, function(fn, val){
        var newVal = [];
        if(type === "debug"){
            newVal = val;
        } else if(type === "release") {
            val.forEach(function(val){
                if(jsMap[val]){
                    newVal.push(jsMap[val]);
                }
            })
        }

        if(yii.util.exists(fn)){
            var data = yii.util.read(fn);
            // data = analyzePhp1(data, newVal, destPath);
            // data = analyzePhp2(data, newVal, destPath, conf.jsSrc, conf.jsDest);
            data = analyzePhp3(data, newVal, destPath, conf.jsSrc, conf.jsDest);
            yii.util.write(fn, data);
        }
    })
    console.info(yii.util.getTime() + " complete handle file");
}

yii = module.exports = {};

yii.util = require('./lib/util.js');

function run(){
    if(!yii.util.exists(pth.join(__dirname, "map.json"))){
            var content = [
            '   Please create map.json file in current folder first',
            '   Data structure maybe like this:',
            '   {',
            '       "jsSrc": "static/modules",',
            '       "jsDest": "js/modules",',
            '       "checkPath": "protected/views"',
            '   }'
        ].join('\n');
        console.log(content);
        return false;
    }

    conf = yii.util.readJSON(pth.join(__dirname, "map.json"));

    if(!yii.util.isDir(conf.jsDest)){
        console.log("jsDest value in map.json file is error.")
        return false;
    }
    if(!yii.util.isDir(conf.checkPath)){
        console.log("checkPath value in map.json file is error.")
        return false;
    }
    if(yii.util.isDir(conf.jsSrc)){
        jsFileList = yii.util.getFileNames(conf.jsSrc);
    } else {
        console.log("jsSrc value in map.json file is error.")
        return false;
    }

    //强制、不存在和为空是，生成map.json中js对象文件关联关系
    if((process.argv[2] === "map" || process.argv[3] === "map" || (!conf.js || yii.util.isEmpty(conf.js))) 
        && conf.jsSrc && conf.checkPath){
        conf.js = findRelated(jsFileList, conf.checkPath);
        yii.util.write("./map.json", JSON.stringify(conf, null, 4).replace(/\\\\/g, "/"));
    }

    if(process.argv[2] === undefined || process.argv[2] === "debug" || process.argv[3] === "debug"){
        type = "debug";//默认为debug模式
    } else if(process.argv[2] === "release" || process.argv[3] === "release") {
        type = "release";
    }
    // console.log("type = ",type)
    build(type);
}

run();
// conf = yii.util.readJSON(pth.join(__dirname, "map.json"));
// yii.util.recursiveFile(conf.checkPath, function(fn){
//     console.info(fn + " line number is ", yii.util.countFileLines(fn));
// });
// console.info(yii.util.getFileNames("./static"));