var crypto = require('crypto');

var oracledb = require("oracledb");
var dbConfig = require("./dbConfig.js");
oracledb.autoCommit = true;

// mybatis-mapper 추가
var mybatisMapper = require('mybatis-mapper');

// Mapper Load(xml이 있는 디렉토리 주소&파일위치)
mybatisMapper.createMapper( ['./mapper/IndexDAO_SQL.xml']);

module.exports = function(app){
	var bodyParser = require('body-parser');
	app.use(bodyParser.urlencoded({extended:true}));
	app.use(bodyParser.json());

	const session = require('express-session');
	const MemoryStore = require('memorystore')(session);

	const maxAge = 1000 * 60 * 120; // 쿠키의 maxAge를 이용해서 세션 유효기간 설정. 120분

	const sessionObj = {
		secret: 'kong',
		resave: false,
		saveUninitialized: true,
		store: new MemoryStore({ checkPeriod: maxAge }),
		cookie: {
			maxAge,
		},
	};

	app.use(session(sessionObj));

	var conn;

	// 기본 index로 설정
	app.get('/', function(req, res, next){
		if(req.session.user == "" || req.session.user == null){
			res.render('./user/login',{"type":"login", "groupSn":""});
		} else {
			res.render('index',{"type":"login", "emplyrSn":req.session.user.emplyrSn});
		}
	})

	app.get('/index', function(req, res, next){
		var groupSn = req.query.groupSn;
		var type = "";

		if(groupSn != null && groupSn != ""){
			type = "group";
		} else {
			type = "login";
		}

		if(req.session.user == "" || req.session.user == null){
			res.render('./user/login',{"type":type, "groupSn":groupSn});
		} else {
			res.render('index',{"type":type, "emplyrSn":req.session.user.emplyrSn, "groupSn":groupSn});
		}
	})

	// 그룹 초대를 받아 온 화면 
	app.get('/index/group', function(req, res, next){
		var groupSn = req.query.groupSn;
		if(req.session.user == "" || req.session.user == null){
			res.render('./user/login',{"type":"group", "groupSn":groupSn});
		} else {
			res.render('index',{"emplyrSn":req.session.user.emplyrSn, "type":"group", "groupSn":groupSn});
		}
	})

	// 전체 파일 용량 읽어오기
	app.post("/selectFileVolume", function(req, res){		
		oracledb.getConnection({
			user:dbConfig.user,
			password:dbConfig.password,
			connectString:dbConfig.connectString,
			externalAuth  : dbConfig.externalAuth
		},function(err,con){
			if(err){
				console.log("Oracle Connection failed(selectFileVolume)",err);
			} else {
				console.log("Oracle Connection success(selectFileVolume)");
			}
			conn = con;

			var param = {
				emplyrSn : req.body.emplyrSn
			}

			//query format
			let format = {language: 'sql', indent: ''};

			//getStatement(namespace명, queryId, parameter, format);
			let query = mybatisMapper.getStatement('IndexDAO','selectFileVolume', param, format);

			//쿼리문 실행
			conn.execute(query, function(err,result){
				if(err){
					console.log("selectFileVolume failed>", err);
					doRelease(conn);
					return;
				}
				
				res.send(result.rows);
				doRelease(conn);					
			});  
		});
	})

	//로그인
	app.post("/frmNIDLogin", function(req, res, next){
		oracledb.getConnection({
			user:dbConfig.user,
			password:dbConfig.password,
			connectString:dbConfig.connectString,
			externalAuth  : dbConfig.externalAuth
		},function(err,con){
			if(err){
				console.log("Oracle Connection failed(/frmNIDLogin)",err);
			} else {
				console.log("Oracle Connection success(/frmNIDLogin)");
			}
			conn = con;
		
			var param = {
				id : req.body.id,
				pw : req.body.pw
			}

			//query format
			let format = {language: 'sql', indent: ''};

			//comparePw
			let comparePwQuery = mybatisMapper.getStatement('UserDAO','comparePw', param, format);
			
			conn.execute(comparePwQuery, function(err,result){
				if(err){
					console.log("comparePwQuery failed"+err);
					res.json("F");
				} else {					
					if(result.rows == ""|| result.rows == null){
						console.log("LOGIN failed");
						res.json("I");
						return;
					} else if (result.rows[0][4] > 1 && result.rows[0][4]%5 == 0 && result.rows[0][6] == 'Y'){	// 비밀번호 오류 횟수, 10분이내(Y)
						res.json("O");
						return;
					}
					var errorCnt = result.rows[0][4];

					var dbPw = result.rows[0][2];
					var inputPw = req.body.pw;
					var dbId = result.rows[0][1];
					var salt = result.rows[0][3];
					let hashPassword = crypto.createHash("sha256").update(inputPw + salt).digest("hex");
					
					if (dbPw === hashPassword){

						req.session.user = {
							emplyrSn: result.rows[0][0],
							name: 'test',
							authorized: true
						};

						let updateErrorCoInit = mybatisMapper.getStatement('UserDAO','updateErrorCoInit', {'emplyrId':dbId}, format);
				
						conn.execute(updateErrorCoInit, function(err,result){
							if(err){
								console.log("updateErrorCoInit failed");
								res.json("F");
							} else {
								res.json("S");
							}							
						});
					} else {
						console.log("LOGIN failed");
						let updateErrorCo = mybatisMapper.getStatement('UserDAO','updatePasswordErrorCo', {'emplyrId':req.body.id}, format);
				
						conn.execute(updateErrorCo, function(err,result){
							if(err){
								console.log("updateErrorCo failed");
								res.json("F");
							} else if(errorCnt%5 == 4){
								res.json("O");
							} else {
								res.json("N");
							}							
						});
					}
				}
			});
		});
	})

	// 회원가입시 아이디 중복체크
	app.post("/chkDuplId", function(req, res, next){	
		oracledb.getConnection({
			user:dbConfig.user,
			password:dbConfig.password,
			connectString:dbConfig.connectString,
			externalAuth  : dbConfig.externalAuth
		},function(err,con){
			if(err){
				console.log("Oracle Connection failed(/chkDuplId)",err);
			} else {
				console.log("Oracle Connection success(/chkDuplId)");
			}
			conn = con;
				
			//query format
			let format = {language: 'sql', indent: ''};
			
			//아이디 중복 체크
			let query = mybatisMapper.getStatement('UserDAO','selectUserId', {id : req.body.id}, format);

			conn.execute(query, function(err,result){
				if(err){
					console.log("chkDuplId failed");
					res.json("F");
				} else {
					if(result.rows[0][0] == 0){	// 중복아이디가 없음
						res.json("S");	//사용가능한 아이디
					} else {	// 중복아이디 존재
						res.json("N");	//사용중인 아이디
					}
				}
				doRelease(conn);
			});
		});
	})
	
	// 회원가입
	app.post("/frmNIDJoin", function(req, res, next){		
		var id = req.body.id;
		var pw = req.body.pw;
		var name = req.body.name;
		var gender = req.body.gender;
		var email = req.body.email;
		var phoneNo = req.body.phoneNo;
		
		oracledb.getConnection({
			user:dbConfig.user,
			password:dbConfig.password,
			connectString:dbConfig.connectString,
			externalAuth  : dbConfig.externalAuth
		},function(err,con){
			if(err){
				console.log("Oracle Connection failed(/Join)",err);
			} else {
				console.log("Oracle Connection success(/Join)");
			}
			conn = con;
				
			//query format
			let format = {language: 'sql', indent: ''};
			
			//emplyrSn MAX값 찾기
			let query = mybatisMapper.getStatement('UserDAO','selectemplyrSn', {}, format);

			conn.execute(query, function(err,result){
				if(err){
					console.log(err);
				} else {
					var salt = Math.round((new Date().valueOf() * Math.random()))+"";
					var hashPassword = crypto.createHash("sha256").update(pw + salt).digest("hex");

					var emplyrSn = result.rows[0][0];

					var param = {
						id : id,
						pw : hashPassword,
						salt : salt,
						name : name,
						gender : gender,
						email : email,
						phoneNo : phoneNo,
						emplyrSn: emplyrSn
					}

					//insert
					let InstQuery = mybatisMapper.getStatement('UserDAO','joinUser', param, format);

					//쿼리문 실행(insert)
					conn.execute(InstQuery, function(err,result){
						//22.11.14 쿼리문 출력때문에 추가
						console.log(InstQuery);

						if(err){
							console.log("JOIN failed "+err);
							res.json("F");
						}
						res.json("S");
						// 커밋
						conn.commit();
					});				
				}
				//doRelease(conn);
			});
		});
	})

	//비밀번호 찾기
	app.post("/findPw", function(req, res, next){
		oracledb.getConnection({
			user:dbConfig.user,
			password:dbConfig.password,
			connectString:dbConfig.connectString,
			externalAuth  : dbConfig.externalAuth
		},function(err,con){
			if(err){
				console.log("Oracle Connection failed(/findPw)",err);
			} else {
				console.log("Oracle Connection success(/findPw)");
			}
			conn = con;

			//query format
			let format = {language: 'sql', indent: ''};

			//comparePw
			let comparePwQuery = mybatisMapper.getStatement('UserDAO','comparePw', {'id' : req.body.userId}, format);
			
			conn.execute(comparePwQuery, function(err,result){
				if(err){
					console.log("comparePwQuery failed"+err);
					res.json("F");
				} else {
					if(result.rows == ""|| result.rows == null){
						res.json("I");	//입력하신 아이디를 찾을 수 없습니다.
						return;
					}

					res.json({"emplyrSn":result.rows[0][0], "phoneNo":result.rows[0][7]});
					doRelease(conn);
				}
			});
		});
	})

	//비밀번호 찾기시 휴대폰 번호 불러오기
	app.post("/findPhoneNo", function(req, res, next){
		oracledb.getConnection({
			user:dbConfig.user,
			password:dbConfig.password,
			connectString:dbConfig.connectString,
			externalAuth  : dbConfig.externalAuth
		},function(err,con){
			if(err){
				console.log("Oracle Connection failed(/findPhoneNo)",err);
			} else {
				console.log("Oracle Connection success(/findPhoneNo)");
			}
			conn = con;

			//query format
			let format = {language: 'sql', indent: ''};

			//seletPhonNo
			let seletPhonNo = mybatisMapper.getStatement('UserDAO','seletPhonNo', {'emplyrSn' : req.body.emplyrSn}, format);

			conn.execute(seletPhonNo, function(err,result){
				if(err){
					console.log("seletPhonNo failed"+err);
					res.json({"status":"F"});
				} else {
					var phoneNo = result.rows[0][0];
					var secretPhNo = result.rows[0][1];
					res.json({
							"phoneNo":result.rows[0][0], 
							"secretPhNo" : result.rows[0][1],
							"emplyrId" : result.rows[0][2]
						});
				}
				doRelease(conn);
			});
		});
	});

	// 비밀번호 재설정
	app.post("/updatePassword", function(req, res, next){
		var id = req.body.id;
		var pw = req.body.pw;
		
		oracledb.getConnection({
			user:dbConfig.user,
			password:dbConfig.password,
			connectString:dbConfig.connectString,
			externalAuth  : dbConfig.externalAuth
		},function(err,con){
			if(err){
				console.log("Oracle Connection failed(/updatePassword)",err);
			} else {
				console.log("Oracle Connection success(/updatePassword)");
			}
			conn = con;
				
			//query format
			let format = {language: 'sql', indent: ''};			
			
			var salt = Math.round((new Date().valueOf() * Math.random()))+"";
			var hashPassword = crypto.createHash("sha256").update(pw + salt).digest("hex");

			var param = {
				id : id,
				pw : hashPassword,
				salt : salt
			}

			//insert
			let InstQuery = mybatisMapper.getStatement('UserDAO','updatePassword', param, format);

			//쿼리문 실행(insert)
			conn.execute(InstQuery, function(err,result){
				if(err){
					console.log("JOIN failed "+err);
					res.json("F");
				}
				res.json("S");
			});
			
			doRelease(conn);
		});
	})
	
	// id존재여부 쿼리 (아이디찾기 휴대폰인증 시 필요)
	app.post("/findId", function(req, res, next){		
		oracledb.getConnection({
			user:dbConfig.user,
			password:dbConfig.password,
			connectString:dbConfig.connectString,
			externalAuth  : dbConfig.externalAuth
		},function(err,con){
			if(err){
				console.log("Oracle Connection failed(/updatePassword)",err);
			} else {
				console.log("Oracle Connection success(/updatePassword)");
			}
			conn = con;
				
			//query format
			let format = {language: 'sql', indent: ''};

			//select
			let selectQuery = mybatisMapper.getStatement('UserDAO','selectId', {"phoneNo":req.body.phoneNo}, format);

			//쿼리문 실행(select)
			conn.execute(selectQuery, function(err,result){
				if(err){
					console.log("JOIN failed "+err);
					res.json("F");
				} else if (result.rows[0][0] == "" || result.rows[0][0] == null){
					res.json("N");
				} else {
					res.json("Y");
				}
				
			});
			
			doRelease(conn);
		});
	})

	// 휴대폰번호에 해당하는 아이디 리스트
	app.post("/choiceIdList", function(req, res, next){		
		oracledb.getConnection({
			user:dbConfig.user,
			password:dbConfig.password,
			connectString:dbConfig.connectString,
			externalAuth  : dbConfig.externalAuth
		},function(err,con){
			if(err){
				console.log("Oracle Connection failed(/updatePassword)",err);
			} else {
				console.log("Oracle Connection success(/updatePassword)");
			}
			conn = con;
				
			//query format
			let format = {language: 'sql', indent: ''};

			//select
			let selectQuery = mybatisMapper.getStatement('UserDAO','selectId', {"phoneNo":req.body.phoneNo}, format);

			//쿼리문 실행(select)
			conn.execute(selectQuery, function(err,result){
				if(err){
					console.log("JOIN failed "+err);
					res.json("F");
				}
				res.json(result.rows);
			});
			doRelease(conn);
		});
	})


	function doRelease(conn){
		conn.close(function(err){
			if(err){
				console.log("doRelease error!");
				console.error(err.message);
			}
		})
	}
}
