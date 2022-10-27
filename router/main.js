module.exports = function(app){
    app.get('/', function(req, res){
        res.render('index.html');
    })

    app.get('/photo', function(req, res){
        res.render('photo.ejs');
    })

    app.get('/movie', function(req, res){
        res.render('movie.html');
    })

    app.get('/document', function(req, res){
        res.render('document.html');
    })

    app.get('/music', function(req, res){
        res.render('music.html');
    })

    app.get('/trash', function(req, res){
        res.render('trash.html');
    })
    
    app.get('/about', function(req, res){
        res.render('about.html');
    })

    var array = [];
    for(var i =0; i < 5; i++){
    array[i] = {
        id : i,
        value : i*i
    };

    
//클라이언트로부터 regist를 요청받으면
app.post("/selectTest",function(request, response){
    console.log("클라이언트로부터 regist 요청");
    //쿼리문 실행 
    conn.execute("SELECT EMPLYR_NM, PASSWORD_ERROR_CO FROM TCM_EMPLYR WHERE EMPLYR_SN = '19940305'",
			function(err,result){
				if(err){
					console.log("에러가 발생했습니다.", err);
                    doRelease(conn);
		            return;
				}
                console.log("성공!");
                console.log(result);

                doRelease(conn, result.rows);
        });
        
        function doRelease(conn, userlist){
            console.log("doRelease");
            conn.close(function(err){
                if(err){
                    console.error(err.message);
                }
            })
            
            response.send(userlist);
        }
    })
}

// var output = _.filter(array, function(item){
//     return item.value < 50;
// });
// console.log('filter', output);

// var output = _.reject(array, function(item){
//     return item.value < 50;
// });
// console.log('reject', output);

// var output = _.map(array, function(item){
//     return item.id + ':' + item.value;
// });
// console.log('map', output);

// var output = _.find(array, function(item){
//     return item.id == 5;
// });
// console.log('find', output);

// var output = _.sordBy(array, function(item){
//     return item.id;
// });
// console.log('sordBy', output);

    var files = [
        { Num : 1, fileSn : 1, fileNm : 'file1' }
        , { Num : 2, fileSn : 2, fileNm : 'file2'}
        , { Num : 3, fileSn : 3, fileNm : 'file3'}
        , { Num : 4, fileSn : 4, fileNm : 'file4'}
        , { Num : 5, fileSn : 5, fileNm : 'file5'}
    ]

    app.post('/files/get', function(request, response){
        var output = null;

        var sidx = request.param('sidx');
        if(sidx == ''){
            sidx = 'id';
        }

        output = _.sortBy(files, function(item){
            return item[sidx];
        });

        var sord = request.param('sord');
        if(sord == 'desc'){
            output = output.reverse();
        }

        var page = Number(request.param('page'));
        var rows = Number(request.param('rows'));
        var totalRecords = files.length;
        var totalPages = Math.ceil(totalRecords/rows);
        var start = rows * page - rows;

        output = output.slice(start, start+rows);

        var param = {
            page : page,
            total : totalPages,
            records : totalRecords,
            rows : _.map(output, function(item){
                return{
                    id : item.id
                    , ceil : _.toArray(item)
                }
            })
        }
        response.send(param);
    })
}