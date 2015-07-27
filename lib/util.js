

'use strict';

var fs = require('fs'),
    pth = require('path'),
    crypto = require('crypto'),
    Url = require('url'),
    _exists = fs.existsSync || pth.existsSync,
    toString = Object.prototype.toString,
    iconv, tar;

var _ = module.exports = function(){
    
};

function getIconv(){
    if(!iconv){
        iconv = require('iconv-lite');
    }
    return iconv;
}

_.exists = _exists;
_.fs = fs;

_.is = function(source, type){
    return toString.call(source) === '[object ' + type + ']';
};

_.map = function(obj, callback, merge){
    var index = 0;
    for(var key in obj){
        if(obj.hasOwnProperty(key)){
            if(merge){
                callback[key] = obj[key];
            } else if(callback(key, obj[key], index++)) {
                break;
            }
        }
    }
};

_.isFile = function(path){
    return _exists(path) && fs.statSync(path).isFile();
};

_.isDir = function(path){
    return _exists(path) && fs.statSync(path).isDirectory();
};

_.md5 = function(data, len){
    var md5sum = crypto.createHash('md5'),
        encoding = typeof data === 'string' ? 'utf8' : 'binary';
    md5sum.update(data, encoding);
    // len = len || 7;
    return md5sum.digest('hex');//.substring(0, len);
};

_.isEmpty = function (obj) {
    if (obj === null) return true;
    if (_.is(obj, 'Array')) return obj.length == 0;
    for (var key in obj) {
        if (obj.hasOwnProperty(key)) {
            return false;
        }
    }
    return true
};

_.isUtf8 = function(bytes) {
    var i = 0;
    while(i < bytes.length) {
        if((// ASCII
            0x00 <= bytes[i] && bytes[i] <= 0x7F
        )) {
            i += 1;
            continue;
        }
        
        if((// non-overlong 2-byte
            (0xC2 <= bytes[i] && bytes[i] <= 0xDF) &&
            (0x80 <= bytes[i+1] && bytes[i+1] <= 0xBF)
        )) {
            i += 2;
            continue;
        }
        
        if(
            (// excluding overlongs
                bytes[i] == 0xE0 &&
                (0xA0 <= bytes[i + 1] && bytes[i + 1] <= 0xBF) &&
                (0x80 <= bytes[i + 2] && bytes[i + 2] <= 0xBF)
            ) || (// straight 3-byte
                ((0xE1 <= bytes[i] && bytes[i] <= 0xEC) ||
                bytes[i] == 0xEE ||
                bytes[i] == 0xEF) &&
                (0x80 <= bytes[i + 1] && bytes[i + 1] <= 0xBF) &&
                (0x80 <= bytes[i + 2] && bytes[i + 2] <= 0xBF)
            ) || (// excluding surrogates
                bytes[i] == 0xED &&
                (0x80 <= bytes[i + 1] && bytes[i + 1] <= 0x9F) &&
                (0x80 <= bytes[i + 2] && bytes[i + 2] <= 0xBF)
            )
        ) {
            i += 3;
            continue;
        }
        
        if(
            (// planes 1-3
                bytes[i] == 0xF0 &&
                (0x90 <= bytes[i + 1] && bytes[i + 1] <= 0xBF) &&
                (0x80 <= bytes[i + 2] && bytes[i + 2] <= 0xBF) &&
                (0x80 <= bytes[i + 3] && bytes[i + 3] <= 0xBF)
            ) || (// planes 4-15
                (0xF1 <= bytes[i] && bytes[i] <= 0xF3) &&
                (0x80 <= bytes[i + 1] && bytes[i + 1] <= 0xBF) &&
                (0x80 <= bytes[i + 2] && bytes[i + 2] <= 0xBF) &&
                (0x80 <= bytes[i + 3] && bytes[i + 3] <= 0xBF)
            ) || (// plane 16
                bytes[i] == 0xF4 &&
                (0x80 <= bytes[i + 1] && bytes[i + 1] <= 0x8F) &&
                (0x80 <= bytes[i + 2] && bytes[i + 2] <= 0xBF) &&
                (0x80 <= bytes[i + 3] && bytes[i + 3] <= 0xBF)
            )
        ) {
            i += 4;
            continue;
        }
        return false;
    }
    return true;
};

/*Function name _.ext
* return data structure
* { origin: 'protected/views/activities/actDetail.php',
*  rest: 'protected/views/activities/actDetail',
*  hash: '',
*  query: '',
*  fullname: 'protected/views/activities/actDetail.php',
*  dirname: 'protected/views/activities',
*  ext: '.php',
*  filename: 'actDetail',
*  basename: 'actDetail.php' }
*/
_.ext = function(str){
    var info = _.query(str), pos;
    str = info.fullname = info.rest;
    if((pos = str.lastIndexOf('/')) > -1){
        if(pos === 0){
            info.rest = info.dirname = '/';
        } else {
            info.dirname = str.substring(0, pos);
            info.rest = info.dirname + '/';
        }
        str = str.substring(pos + 1);
    } else {
        info.rest = info.dirname = '';
    }
    if((pos = str.lastIndexOf('.')) > -1){
        info.ext = str.substring(pos).toLowerCase();
        info.filename = str.substring(0, pos);
        info.basename = info.filename + info.ext;
    } else {
        info.basename = info.filename = str;
        info.ext = '';
    }
    info.rest += info.filename;
    return info;
};
/*Function name _.query
* return data structure 
*{ origin: 'protected/views/activities/actDetail.php',
*  rest: 'protected/views/activities/actDetail.php',
*  hash: '',
*  query: '' }
*/
_.query = function(str){
    var rest = str,
        pos = rest.indexOf('#'),
        hash = '',
        query = '';
    if(pos > -1){
        hash = rest.substring(pos);
        rest  = rest.substring(0, pos);
    }
    pos = rest.indexOf('?');
    if(pos > -1){
        query = rest.substring(pos);
        rest  = rest.substring(0, pos);
    }
    rest = rest.replace(/\\/g, '/');
    if(rest !== '/'){
        rest = rest.replace(/\/\.?$/, '');
    }
    return {
        origin : str,
        rest : rest,
        hash : hash,
        query : query
    };
};

_.pathinfo = function(path){
    //can not use _() method directly for the case _.pathinfo('a/').
    var type = typeof path;
    if(arguments.length > 1) {
        path = Array.prototype.join.call(arguments, '/');
    } else if(type === 'string') {
        //do nothing for quickly determining.
    } else if(type === 'object') {
        path = Array.prototype.join.call(path, '/');
    }
    return _.ext(path);
};

_.mkdir = function(path, mode){
    if (typeof mode === 'undefined') {
        //511 === 0777
        mode = 511 & (~process.umask());
    }
    if(_exists(path)) return;
    path.split('/').reduce(function(prev, next) {
        if(prev && !_exists(prev)) {
            fs.mkdirSync(prev, mode);
        }
        return prev + '/' + next;
    });
    if(!_exists(path)) {
        fs.mkdirSync(path, mode);
    }
};

_.readBuffer = function(buffer){
    if(_.isUtf8(buffer)){
        buffer = buffer.toString('utf8');
        if (buffer.charCodeAt(0) === 0xFEFF) {
            buffer = buffer.substring(1);
        }
    } else {
        buffer = getIconv().decode(buffer, 'gbk');
    }
    return buffer;
};

_.read = function(path, convert){
    var content = false;
    if(_exists(path)){
        content = fs.readFileSync(path);
        // if(convert || _.isTextFile(path)){
            content = _.readBuffer(content);
        // }
    } else {
        console.error('unable to read file[' + path + ']: No such file or directory.');
    }
    return content;
};

_.write = function(path, data, charset, append){
    if(!_exists(path)){
        _.mkdir(_.pathinfo(path).dirname);
    }
    if(charset){
        data = getIconv().encode(data, charset);
    }
    if(append) {
        fs.appendFileSync(path, data, null);
    } else {
        fs.writeFileSync(path, data, null);
    }
};

_.readJSON = function(path){
    var json = _.read(path),
        result = {};
    try {
        result = JSON.parse(json);
    } catch(e){
        console.error('parse json file[' + path + '] fail, error [' + e.message + ']');
    }
    return result;
};

_.addLastSlash = function(str){
    if(str.lastIndexOf("/") !== str.length){
        str = str + "/";
    }
    return str;
}

/* getFileNames
*  查询给定文件夹中所有文件的名称（不包含文件夹名）
*  path    : 文件夹名
*  Return  : 数组 or 空数组
*/
_.getFileNames = function(path){
    if(_.isDir(path)){
        var arr = fs.readdirSync(path),
            returnArr = [];
        arr.forEach(function(ele){
            if(!_.isDir(pth.join(path, ele))){
                returnArr.push(ele);
            }
        })
        return returnArr;
    }
    return [];
}
/* recursiveFile
*  递归文件夹，通过回调函数返回文件名
*  fileName: 文件夹名
*  cb      : 回调函数 cb(fileName)
*  Return  : undefined
*/
_.recursiveFile = function(fileName, cb){

    if(!_.exists(fileName)) return;

    if(_.isFile(fileName)){
        cb(fileName);
    }

    if(_.isDir(fileName)){
        var files = fs.readdirSync(fileName);
        files.forEach(function(val){
            var temp = pth.join(fileName,val);
            if (_.isDir(temp)) _.recursiveFile(temp, cb);
            if (_.isFile(temp)) cb(temp);
        })
    }
}
/* getTime
*  获取当前时间，返回时间格式为："HH:mm:ss"
*  Return : time value, Format "HH:mm:ss"
*/
_.getTime = function(){
    return _.format(new Date(), "HH:mm:ss");
}
/* countFileLines
*  统计文件代码行数
*  fileName： 文件名
*  Return  :  lines
*/
_.countFileLines = function(filename){
    var data = _.read(filename),
        regStr = /\n/ig,
        lines = 0;

    if(!data){//文件读取失败 data = false，将data置空
        return 0;
    }

    data.replace(regStr, function(m){
        lines++;
        return m;
    });
    //
    if(data.length > 0){
        lines++;
    }
    return lines;
}

/*
*TODO:@brief: format the date object.
*     @param: format demo
*     @return: string after format.
*     @remark: date.format("yyyy-MM-dd hh:mm");
*/
_.format = function(d, mask) {     
 
    // var d = this;     
    
    var zeroize = function (value, length) {     
    
        if (!length) length = 2;     
    
        value = String(value);     
    
        for (var i = 0, zeros = ''; i < (length - value.length); i++) {     
    
            zeros += '0';     
    
        }     
    
        return zeros + value;     
    
    };       
    
    return mask.replace(/"[^"]*"|'[^']*'|\b(?:d{1,4}|m{1,4}|yy(?:yy)?|([hHMstT])\1?|[lLZ])\b/g, function($0) {     
    
        switch($0) {     
    
            case 'd':   return d.getDate();     
    
            case 'dd':  return zeroize(d.getDate());     
    
            case 'ddd': return ['Sun','Mon','Tue','Wed','Thr','Fri','Sat'][d.getDay()];     
    
            case 'dddd':    return ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][d.getDay()];     
    
            case 'M':   return d.getMonth() + 1;     
    
            case 'MM':  return zeroize(d.getMonth() + 1);     
    
            case 'MMM': return ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()];     
    
            case 'MMMM':    return ['January','February','March','April','May','June','July','August','September','October','November','December'][d.getMonth()];     
    
            case 'yy':  return String(d.getFullYear()).substr(2);     
    
            case 'yyyy':    return d.getFullYear();     
    
            case 'h':   return d.getHours();// % 12 || 12;     
    
            case 'hh':  return zeroize(d.getHours());// % 12 || 12);     
    
            case 'H':   return d.getHours();     
    
            case 'HH':  return zeroize(d.getHours());     
    
            case 'm':   return d.getMinutes();     
    
            case 'mm':  return zeroize(d.getMinutes());     
    
            case 's':   return d.getSeconds();     
    
            case 'ss':  return zeroize(d.getSeconds());     
    
            case 'l':   return zeroize(d.getMilliseconds(), 3);     
    
            case 'L':   var m = d.getMilliseconds();     
    
                    if (m > 99) m = Math.round(m / 10);     
    
                    return zeroize(m);     
    
            case 'tt':  return d.getHours() < 12 ? 'am' : 'pm';     
    
            case 'TT':  return d.getHours() < 12 ? 'AM' : 'PM';     
    
            case 'Z':   return d.toUTCString().match(/[A-Z]+$/);     
    
            // Return quoted strings with the surrounding quotes removed     
    
            default:    return $0.substr(1, $0.length - 2);     
    
        }     
    
    });       
};