const db = require('../utils/db.js')
const nodemailer = require('nodemailer')
const md5 = require('md5')
const Redis_db = (require('../utils/db')).Redis_db
const domain = require('../config/Domain-config')
const Neo4j_db = (require('../utils/db')).Neo4j_db
const randomNos = require('../utils/randomNos')

/*注册*/
async function signup(ctx, next) {
	
	let username = ctx.request.body.username
	let password = ctx.request.body.password
	let email = ctx.request.body.email

	let sql1 = `select * from user where username = '${username}'`
	let data1 = await db.MySQL_db(sql1)

	let msg = ``
	let code = 0

	if(data1.length != 0) {
		code = -1
		msg = "用户名已存在！"

	} else {

		let sql2 = `insert into user (username, password, email) values ('${username}', '${password}', '${email}')`
		await db.MySQL_db(sql2)
		
		let cypher = `create(user:User{username:'${username}'})`
		await Neo4j_db(cypher)
			
		code = 0
		msg = "注册成功！"
		
	}
	ctx.body = {
		code: code,
		data: {
			msg : msg
		}
	}
}
/*删除不需要的地址*/
async function deleteaddress(ctx, next){
	addressNo = ctx.request.body.addressNo
	let sql = `DELETE FROM address WHERE addressNo = '${addressNo}'`
	let data = await db.MySQL_db(sql)
	if( data.length != 0){
		let code = 0
		let msg = "删除成功!"
	}
	else{
		let code = -1
		let msg = "删除失败!"
	}
	ctx.body = {
		code: code,
		data:{
			msg: msg
		}
	}
}
/*找回密码*/
async function retrieve(ctx, next) {

	var params = {
	    host: 'smtp.163.com',
	    port: 465,
	    sercure: true,
	    auth: {
	        user: '18365225454@163.com',
	        pass: 'yetiandi123'
	    }
	} 

	let username = ctx.request.body.username
	let sql = `select username, email from user where username = '${username}'`
	let token = md5(username + (new Date()).toLocaleString() + Math.random())
	let email = (await db.MySQL_db(sql))[0].email
	const mailOptions = {
        from: '18365225454@163.com', 
        to: email, 
        subject: '叶鲜生生鲜超市找回密码', 
        html: `<a href='http://${domain}:8000/#/reset?token=${token}'><b>请在五分钟内点击链接完成验证，并进行密码重置</b></a>` 
    }

    const transporter = nodemailer.createTransport(params)

    await transporter.sendMail(mailOptions, async function(err, info) {

        if (err) { return console.log(err) }
        await Redis_db.set(token, username);
        await Redis_db.expire(token, 300);
        console.log(`Emial sent to ${username}: ${email} sent successfully!`); 
    })

   	ctx.body = {
       	code: 0,
       	data: {
       		msg: '用户身份验证成功！'
   		}
    }
}

/*密码重置*/
async function reset(ctx, next) {

	let token = ctx.request.body.token

	let password = ctx.request.body.password

	let response = await Redis_db.exists(token)
	var msg = ''

	if(response === 1) {

		let username = await Redis_db.get(token)

		let sql = `update user set password = '${password}' where username = '${username}'`
		await db.MySQL_db(sql)
		await Redis_db.del(token)
		msg = '密码重置成功！'
		
	} else if(response === 0){

		msg = '邮箱验证链接已经过期！'
	} 

	ctx.body = {
		code: 0,
		data: {
			msg: msg
		}
	}
}

/*登录*/
async function signin(ctx, next) {

	let username = ctx.request.body.username
	let password = ctx.request.body.password

	let sql = `select * from user where username = '${username}' and password = '${password}'`

	let data = await db.MySQL_db(sql)

	let code = 0
	let msg = ``
	if(data.length === 0) {
			code = -1
			msg = "用户名或密码错误！"
	} else {

		ctx.cookies.set('username', encodeURIComponent(username) , {
			signed: false,
           	domain: domain,
         	path:'*',   
         	maxAge:1000*60*30,
         	httpOnly:false,
         	overwrite:false
		})

		ctx.session.user = {userName: data[0].username}

		code = 0
		msg = "登录成功！"
	
	}

	ctx.body = {
		code: code,
		data: {
			msg : msg
		}
	}
}

/*登出*/
/*增加超时机制*/
/*暂时未手动删除redis数据库中sessionsid*/
async function signout(ctx, next) {
	ctx.session = {}

	ctx.cookies.set('username', '' , {
		signed: false,
       	domain: domain,
     	path: '*',   
     	maxAge: 0,
     	httpOnly: false,
     	overwrite: false
 	})

	ctx.body = {
		code: 0,
		data: {
			msg: "退出成功！"
		}
	}

}

/*查询个人地址*/
async function address(ctx, next) {
	ctx.session.refresh()

	let username = ctx.request.query.username

	let sql = `select * from address where username = '${username}' order by isdefault desc`

	let data = await db.MySQL_db(sql)
	ctx.body = {
		code: 0,
		data: data
	}
}

/*新增个人地址*/
async function insertAddress(ctx, next) {
	ctx.session.refresh()

	let username = ctx.request.body.username
	let province = ctx.request.body.province
	let city = ctx.request.body.city
	let county = ctx.request.body.county
	let street = ctx.request.body.street
	let addressname = ctx.request.body.addressname
	let default_ = ctx.request.body.default

	let sql = `insert into address (username, province, city, county, street, addressname, isdefault) values ('${username}', '${province}', '${city}', '${county}', '${street}', '${addressname}', ${default_})`

	let data = await db.MySQL_db(sql)
	ctx.body = {
		code: 0,
		data: {
			msg: "填写成功！"
		}
	}
}

/*用户购买商品*/
async function buy(ctx, next) {
	ctx.session.refresh()
	
	let goodsList = ctx.request.body.goods

	let orderTime = (new Date()).toLocaleString()

	let username = goodsList[0].username

	let sql = `insert into receive (username, goodsNo, orderNo, num, orderTime, subtotal, address) values `

	for(let i=0; i<goodsList.length; i++) {
		if(i < goodsList.length - 1) {
			sql += `('${username}', '${goodsList[i].goodsNo}', '${md5(username + orderTime + goodsList[i].subtotal)}', '${goodsList[i].num}', '${orderTime}', ${goodsList[i].subtotal}, '${goodsList[i].address}'), `

		} else {
			sql += `('${username}', '${goodsList[i].goodsNo}', '${md5(username + orderTime + goodsList[i].subtotal)}', '${goodsList[i].num}', '${orderTime}', ${goodsList[i].subtotal}, '${goodsList[i].address}');`
		}
	}


	for (let i=0; i<goodsList.length; i++) {

		if(i < goodsList.length - 1) {
			sql += `UPDATE goods SET inventory = inventory - '${goodsList[i].num}' WHERE goodsNo = '${goodsList[i].goodsNo}';`
		} else {
			sql += `UPDATE goods SET inventory = inventory - '${goodsList[i].num}' WHERE goodsNo = '${goodsList[i].goodsNo}'`
		}
	
	}

	await db.MySQL_db(sql)
	
	let cypher = `match(user:User{username: '${username}'}),`

	for(let j=0; j<goodsList.length; j++) {
		let node_name = '_' + j 
		if(j < goodsList.length - 1) {
			cypher += `(${node_name}:Goods{goodsNo:${goodsList[j].goodsNo}}),`
		} else {
			cypher += `(${node_name}:Goods{goodsNo:${goodsList[j].goodsNo}})`
		}
	}

	cypher += `create`

	for(let i=0; i<goodsList.length; i++) {
		node_name = '_' + i
		if(i < goodsList.length - 1) {
			cypher += `(user)-[:Buy{num:${goodsList[i].num}}]->(${node_name}), `
		} else {
			cypher += `(user)-[:Buy{num:${goodsList[i].num}}]->(${node_name})`
		}
		
	}

	await Neo4j_db(cypher)

	ctx.body = {
		code: 0,
		data: {
			msg: "下单成功！"
		}
	}
	

}

/*个人推荐（猜你喜欢）*/
async function fav(ctx, next) {
	ctx.session.refresh()
	let username = ctx.request.body.username
	let cypher = `match p=(host:User)-[:SimilarTo|Buy*1..6]-(pg:Goods)
                    where host.username = '${username}'
                    and not (host)-[:Buy]->(pg)
                    return pg.goodsNo as goodsNo
                    limit 5`



    let goodsList = (await Neo4j_db(cypher)).data



    if(goodsList.length != 5) {
    	cypher = `match (goods:Goods)
    				return count(goods) as goodsCount`

    	let max = (await Neo4j_db(cypher)).data[0]

    	goodsList = randomNos(goodsList, 5, max) 

    }

    let sql = `select goodsNo, goodsName, type, subtype, price, inventory, validity, description from goods where goodsNo in (${goodsList[0]}, ${goodsList[1]}, ${goodsList[2]}, ${goodsList[3]}, ${goodsList[4]})`

    let data = await db.MySQL_db(sql)

    ctx.body = {
    	code: 0,
    	data: data
    }
}

module.exports = {
	signup: signup,
	deleteaddress : deleteaddress,
	retrieve: retrieve,
	reset: reset,
	signin: signin,
	fav: fav,
	address: address,
	insertAddress: insertAddress,
	buy: buy,
	signout: signout,	
}

