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

	/**
	 * Save to stored templates
	 * @param {Object} obj 
	 */
	static Save(obj) {
		Object.keys(obj).forEach(k => {
			_stored[k] = obj[k]
		})
	}

	/**
	 * Delete stored template
	 * @param {Array} keys 
	 */
	static Delete(keys) {
		keys.forEach(k => {
			if (_stored[k])
				delete _stored[k]
		})
	}

	static Init(config) {
		Object.assign(_gqlcOpt, config)
		return GraphQLClient
	}

	static ParseTemplate(template, data) {
		let q
		if (data)
			q = JSON.parse(JSON.stringify(template, (k, v) => {
				if (data.hasOwnProperty(v))
					return data[v]
				return v
			}))
		return q
	}

	/**
	 * Request with template
	 * @param {Object} template {"key":"$keyInData"}
	 * @param {Object} data keyInData=>value
	 */
	static Query(template, data) {
		const q = GraphQLClient.ParseTemplate(template, data)
		return GraphQLClient.Do("query", q)
	}
	/**
	 * Request with template
	 * @param {Object} template {"key":"$keyInData"}
	 * @param {Object} data keyInData=>value
	 */
	static Mutation(template, data) {
		const q = GraphQLClient.ParseTemplate(template, data)
		return GraphQLClient.Do("mutation", q)
	}

	/**
	 * Request with stored template
	 * @param {String} name name of stored template
	 * @param {Object} data keyInData=>value
	 */
	static QueryBy(name, data) {
		return GraphQLClient.Query(_stored[name], data)
	}
	/**
	 * Request with stored template
	 * @param {String} name name of stored template
	 * @param {Object} data keyInData=>value
	 */
	static MutationBy(name, data) {
		return GraphQLClient.Mutation(_stored[name], data)
	}

	/**
	 * Send query
	 * @param {Object} q
	 */
	static Get(q) {
		return GraphQLClient.Do('query', q)
	}
	/**
	 * Send mutation
	 * @param {Object} q
	 */
	static Set(q) {
		return GraphQLClient.Do('mutation', q)
	}

	/**
	 * 
	 * @param {string} op : Operation
	 * @param {Object} q : Query
	 */
	static async Do(op, q) {
		const query = GraphQLClient.Build(op, q)
		try {
			return await GraphQLClient.Send(JSON.stringify({ query }))
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

	/**
	 * 
	 * @param {String} data 
	 * @param {Object} optional
	 */
	static async Send(data, { url, method, credentials, headers }) {
		let result = {}
		try {
			const resp = await fetch(url || _gqlcOpt.url, {
				method: method || _gqlcOpt.method,
				headers: Object.assign({
					"Content-Type": "application/json",
					"Accept": "application/json"
				}, headers || _gqlcOpt.headers),
				body: data,
				credentials: credentials || _gqlcOpt.credentials
			})
			result = await resp.json()
		} catch (e) {
			throw e
		}
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