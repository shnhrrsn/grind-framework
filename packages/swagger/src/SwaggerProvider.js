import './Swagger'
import './compileRoute'

export function SwaggerProvider(app) {
	app.routes.get('/swagger.json', (req, res) => {
		const router = app.routes.router
		const stack = router.stack

		if (stack.length <= 0) {
			res.status(400).send({
				error: 'No defined routes',
			})

			return
		}

		const info = require(app.paths.package)

		const paths = {}

		for (const r of stack) {
			const route = r.route
			if (!route) {
				continue
			}

			const result = compileRoute(route, app)

			if (result.isNil) {
				continue
			}

			const { routePath, method, swagger } = result

			const obj = paths[routePath] || {}
			obj[method] = swagger
			paths[routePath] = obj
		}

		res.setHeader('Access-Control-Allow-Origin', '*')
		res.send({
			swagger: '2.0',
			info: {
				version: Swagger.appVersion || info.version || '0.0.1',
				title: Swagger.appName || info.name,
			},
			basePath: Swagger.basePath,
			host: Swagger.host || req.get('Host'),
			schemes: Swagger.schemes || [req.protocol],
			consumes: Swagger.consumes,
			produces: Swagger.produces,
			paths: paths,
		})
	})
}
