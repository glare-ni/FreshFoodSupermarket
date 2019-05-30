const MySQL_db = require('../utils/db.js').MySQL_db

class OrderModel {
	static async add(goodsList, orderTime, username) {
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

		await MySQL_db(sql)
		
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
			let node_name = '_' + i
			if(i < goodsList.length - 1) {
				cypher += `(user)-[:Buy{num:${goodsList[i].num}}]->(${node_name}), `
			} else {
				cypher += `(user)-[:Buy{num:${goodsList[i].num}}]->(${node_name})`
			}
			
		}

		await Neo4j_db(cypher)

		return 
	}
}