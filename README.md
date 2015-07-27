#yii-build

yii-build 应用于php yii Framework项目中静态资源的压缩及发布使用，目前只支持javascript文件的压缩发布（可切换release与debug），其中的lib/util.js 大量参考了百度[FEM](http://fex.baidu.com/) [F.I.S](http://fis.baidu.com/)

##如何使用

安装依赖包：
```sh
$ npm install
```

在与index.js同路径下创建map.json
```javascript
{
    "jsSrc": "static/modules",
    "jsDest": "js/modules",
    "checkPath": "protected/views"
}
```
参数说明：
jsSrc：javascript文件路径（目前只支持单一文件夹）
jsDest: release javascript文件存放路径
checkPath：存在引用javascript的php文件路径


命令：
```sh
$ npm install
```

将会自动生成php对于引用javascript文件关系，map.json 变成类似如下样式：
```json
{
    "jsSrc": "static/modules",
    "jsDest": "js/modules",
    "checkPath": "protected/views",
    "js": {
        "protected/views/detail.php": [
            "detail-load-comment.js",
            "detail.js"
        ],
        "protected/views/activities.php": [
            "dropdown.js",
            "index.js",
            "selectdrop.js"
        ]
}
```

命令说明：

切换至debug
```sh
$ npm install debug
```

切换至release
```sh
$ npm install release
```

强制重新生成map.json js对象（即引用关系），同时可搭配release或debug命令
```sh
$ node index.js map
```
