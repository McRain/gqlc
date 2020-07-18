# gqlbc
GraphQL Client library for browsers 

## Usage

`import gqlapi from "gqlapi"
gqlapi.Init({
	url: https://webserver/grapqlapi`,
	method: "post",
	credentials: "include",
	log: false
})`

###### Query:

`const {user,error} = await gqlapi.Get(
						{
							user: [
								"_id"
								{ rates: ["value", "previos"] }
							]
						},
						null,
						"user"
					)`
    
    
###### Mutation

`const {entrypoint,error} = await gqlapi.Set({
				entrypoint: [
					{
						$args: {
							type: valuetype
						}
					},
					"result",
					"code"
				]
			})`
