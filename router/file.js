var multer = require('multer');

var oracledb = require("oracledb");
var dbConfig = require("./dbConfig.js");

oracledb.autoCommit = true;

// mybatis-mapper 추가
var mybatisMapper = require('mybatis-mapper');

// Mapper Load(xml이 있는 디렉토리 주소&파일위치)
mybatisMapper.createMapper( ['./mapper/UserDAO_SQL.xml']);

var storage = multer.diskStorage({
    destination(req, file, cb){
        cb(null, 'uploadedFiles/');
    },

    //파일 이름 지정 (저장시 파일명이 깨지는 경우가 있는데 다시 불러올 때 DB에 저장해둔 오리지널 파일명 가져오기)
    filename(req, file, cb){
        cb(null, `${file.originalname}_${Date.now()}`);
    },
});

var upload = multer({storage: storage});

module.exports = function(app){
	var conn;

    app.get('/', function(req, res){
        res.render('upload');
    });
    
    app.post('/uploadFile', upload.single('attachment'), function(req, res){
		console.log(req);
		//그냥 파일명을 가져올 경우 한글이 깨지는 오류 수정
		var fileNm = Buffer.from(req.file.originalname, 'latin1').toString('utf8');

        var FILE_STRE_COURS_NM = '/uploadedFiles';
		var ORGINL_FILE_NM = fileNm;
		var FILE_EXTSN_NM = req.file.originalname.split(".")[1];
		var FILE_MG = req.file.size;
		var emplyrSn = req.session.user.emplyrSn;
		
		oracledb.getConnection({
			user:dbConfig.user,
			password:dbConfig.password,
			connectString:dbConfig.connectString,
			externalAuth  : dbConfig.externalAuth
		},function(err,con){
			if(err){
				console.log("Oracle Connection failed(/uploadFile)",err);
			} else {
				console.log("Oracle Connection success(/uploadFile)");
			}
			conn = con;
				
			//query format
			let format = {language: 'sql', indent: ''};
			
			//fileSn 찾아오기
			let query = mybatisMapper.getStatement('IndexDAO','selectFileSn', {}, format);
			
			conn.execute(query, function(err,result){
				console.log("IndexDAO.selectFileSn");
				console.log(query);

				if(err){
					console.log("파일 일련번호 찾기를 실패했습니다.");
					res.json("F");
				} else {
					var param = {
						filePath : FILE_STRE_COURS_NM
						, fileNm : ORGINL_FILE_NM
						, fileExtsnNm : FILE_EXTSN_NM
						, fileSize : FILE_MG
						, emplyrSn : emplyrSn
						, fileSn : result.rows[0][0]
					}

					//파일 등록
					query = mybatisMapper.getStatement('IndexDAO','insertAtchFile', param, format);
					conn.execute(query, function(err,result){
						console.log("IndexDAO.insertAtchFile");
						console.log(query);
						if(err){
							console.log(err);
							res.json("F");
						}
					});
				}

				query = mybatisMapper.getStatement('IndexDAO','insertAtchFileDtl', param, format);
				conn.execute(query, function(err,result){
					console.log("IndexDAO.insertAtchFileDtl");
					console.log(query);

					if(err){
						console.log("fileDtl Insert failed "+err);
						res.json("F");
					}
				});
				doRelease(conn);
			});
		});

		console.log(req.session.user.emplyrSn);
		res.render('index', {"emplyrSn":req.session.user.emplyrSn});
	});

	function doRelease(conn){
		conn.close(function(err){
			if(err){
				console.log("doRelease error!");
				console.error(err.message);
			}
		})
	}
}