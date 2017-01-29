import { Route } from 'express'

let hasExtended = false

export function RouteExtension() {
	if(hasExtended) {
		return
	}

	hasExtended = true

	Route.prototype._addMiddleware = function(source, prepend, ...handlers) {
		if(handlers.length === 1 && Array.isArray(handlers[0])) {
			handlers = handlers[0]
		}

		if(prepend) {
			handlers = handlers.reverse()
		}

		const methods = this.methods

		if(methods.length === 0) {
			throw new Error(`Route.${source}() requires at least one method to be registered.`)
		}

		if(this.stack.length === 0) {
			throw new Error(`Route.${source}() requires at least one handler already be added.`)
		}

		const LayerClass = this.stack[0].constructor

		for(const [ method, enabled ] of Object.entries(methods)) {
			if(!enabled) {
				continue
			}

			for(const handler of handlers) {
				if(typeof handler !== 'function') {
					throw new TypeError(`Route.${source}() requires callback functions but got a ${typeof handler}`)
				}

				const layer = LayerClass('/', { }, handler)
				layer.method = method

				if(prepend) {
					this.stack.unshift(layer)
				} else {
					this.stack.push(layer)
				}
			}
		}

		return this
	}

	Route.prototype.before = function(...handlers) {
		return this._addMiddleware('before', true, ...handlers)
	}

	Route.prototype.after = function(...handlers) {
		return this._addMiddleware('after', false, ...handlers)
	}

	Route.prototype.use = function(...handlers) {
		Log.error('WARNING: `use` has been deprecated in favor of `before` and will be removed in 0.7.')
		return this.before(...handlers)
	}

	Route.prototype.useBefore = function(...handlers) {
		Log.error('WARNING: `useBefore` has been deprecated in favor of `before` and will be removed in 0.7.')
		return this.before(...handlers)
	}

	Route.prototype.useAfter = function(...handlers) {
		Log.error('WARNING: `useAfter` has been deprecated in favor of `after` and will be removed in 0.7.')
		return this.after(...handlers)
	}

	Route.prototype.as = function(name) {
		this.grindRouter.nameRoute(name, this)
		return this
	}

}
