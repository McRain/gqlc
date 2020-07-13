/*eslint-env es6*/
const _gqlcOpt = {
	"method": "post",
	"credentials": "include",
	"log": true,
	"headers": {}
}

const _stored = {}

let _eventHandlers = {}

export default class GraphQLClient {
	static On(event, handler) {
		_eventHandlers[event] = handler
	}
	static Store(obj) {
		Object.keys(obj).forEach(k => {
			_stored[k] = obj[k]
		})
	}
	static Init(config,stored) {
		Object.assign(_gqlcOpt, config)
		GraphQLClient.Store(stored)
		return GraphQLClient
	}
	static Get(q, info, field) {
		const st = performance.now()
		return GraphQLClient.Do('query', q, info, field, null, st)
	}
	static Set(q, info, field) {
		const st = performance.now()
		return GraphQLClient.Do('mutation', q, info, field, null, st)
	}
	static async StoredGet(name, data, info, field) {
		const st = performance.now()
		if (!_stored[name])
			throw new Error(`Unable to find saved query "${name}" `)
		const q = JSON.parse(JSON.stringify(await _stored[name]))
		return GraphQLClient.Do('query', q, info, field, data, st)
	}
	static async StoredSet(name, data, info, field) {
		const st = performance.now()
		const q = JSON.parse(JSON.stringify(await _stored[name]))
		return GraphQLClient.Do('mutation', q, info, field, data, st)
	}
	static Query(template, data){
		const st = performance.now()
		return GraphQLClient.Do("query",template,null,null,data,st)
	}
	static Mutation(template, data){
		const st = performance.now()
		return GraphQLClient.Do("mutation",template,null,null,data,st)
	}


	/**
	 * 
	 * @param {string} op : Operation
	 * @param {Object} q : Query
	 * @param {*} info -Payload
	 * @param {string} field if set - return field
	 * @param {Object} data - Obje
	 * @param {*} startTime 
	 */
	static async Do(op, q, info, field, data, startTime) {
		if (data)
			q = JSON.parse(JSON.stringify(q, (k, v) => {
				if (data.hasOwnProperty(v))
					return data[v]
				return v
			}))
		const query = GraphQLClient.Build(op, q)
		let str = JSON.stringify({ query })
		if (_gqlcOpt.log)
			console.log(`Build time  ${(performance.now() - startTime).toFixed(4)} msec`)
		try {
			const result = await GraphQLClient.Send(str)
			if (_gqlcOpt.log)
				console.log(`Full time ${(performance.now() - startTime).toFixed(4)} msec`)
			if (info)
				return Object.assign(info, (field ? result[field] : result))
			return field ? result[field] : result
		} catch (error) {
			if (_eventHandlers.error)
				_eventHandlers.error(error.code ? error : { error: { code: 400 } })
			if (!error.code)
				return { error: { code: 400 } } //no serverside error
			return { error }
		}
	}

	static Build(op, ...args) {
		let result = `${op} { `
		for (let i = 0; i < args.length; i++)
			result += GraphQLClient.BuildObject(args[i])
		return result + " }"
	}
	static BuildObject(obj) {
		let result = ``
		if (!obj)
			return result
		if (typeof (obj) === "string" || 
			typeof (obj) === "number" || 
			Array.isArray(obj))
			return JSON.stringify(obj)
		Object.keys(obj).forEach((k) => {
			result += k + " "
			const values = obj[k]
			const arg = values.find((element, index, array) => {
				if (!element || typeof element !== "object" || !element.$args)
					return false
				return true
			})
			let acount = 0
			if (arg) {
				result += GraphQLClient.BuildArgs(arg.$args)
				const ind = values.indexOf(arg)
				values.splice(ind, 1)
			}
			result += values.length > acount ? " { " : ""
			for (let i = 0; i < values.length; i++) {
				const o = values[i]
				if (!o)
					continue
				if (typeof (o) === "string") {
					result += o + " "
				} else if (o instanceof Array) {
					result += o.join(' ')
				} else
					result += GraphQLClient.BuildObject(o)
			}
			result += values.length > acount ? " } " : ""
		})
		return result
	}

	static BuildArgs(args) {
		let result = " ( "
		Object.keys(args).forEach((k) => {
			result += k + ":"
			const vals = args[k]
			if (vals instanceof Array) {
				if (vals.length === 0)
					result += "[],"
				else {
					const v = vals[0]
					if (typeof (v) === "string")
						result += JSON.stringify(vals) + ","
					else if (typeof (v) === "number")
						result += "[" + vals.join(',') + "],"
					else {
						result += "["
						vals.forEach((el) => {
							result += "{"
							Object.keys(el).forEach((kl) => {
								result += kl + ":" + GraphQLClient.BuildObject(el[kl]) + ","
							})
							result = result.slice(0, -1) + "},"
						})
						result = result.slice(0, -1) + "],"
					}
				}
			} else
				result += JSON.stringify(vals) + ","
		})
		return result.slice(0, -1) + " ) "
	}

	static async Send(data) {
		let resp
		try {
			resp = await fetch(_gqlcOpt.url, {
				method: _gqlcOpt.method,
				headers: Object.assign({
					"Content-Type": "application/json",
					"Accept": "application/json"
				}, _gqlcOpt.headers),
				body: data,
				credentials: _gqlcOpt.credentials
			})
		} catch (e) {
			throw e
		}
		const result = await resp.json()
		if (result.error)
			throw new GraphError(result.error)
		return result.data
	}
}

class GraphError extends Error {
	constructor(obj) {
		super(obj.message)
		this.code = obj.code
	}
}