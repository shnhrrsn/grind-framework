import './BaseCommand'

import { FS } from 'grind-support'

const crypto = require('crypto')
const path = require('path')
const Ignore = require('ignore')

export class PublishCommand extends BaseCommand {
	name = 'assets:publish'
	description = 'Compies and publishes all assets'

	resourcesPath = null
	assetsPath = null
	publishPath = null
	assets = { }
	oldAssets = { }
	factory = null

	ready() {
		return super.ready().then(result => {
			this.factory = this.app.assets
			return result
		})
	}

	async run() {
		this.resourcesPath = this.app.paths.base('resources')
		this.assetsPath = path.join(this.resourcesPath, 'assets')
		this.publishPath = this.app.paths.public()
		this.oldAssets = await this.loadOldAssets()

		if(this.oldAssets.isNil) {
			this.oldAssets = { }
		}

		await this.compile()

		await this.writeConfig(this.assets)
		await this.removeAssets(this.oldAssets)
	}

	async compile() {
		const assets = await this.findAssets(this.assetsPath)

		for(const asset of assets) {
			let content = null

			try {
				this.comment('Compiling', path.relative(this.app.paths.base(), asset.path))
				content = await asset.compile()
			} catch(err) {
				let message = err.message || 'Unknown error'

				if(!err.file.isNil) {
					message += `\n --> File: ${err.file}`
				}

				if(!err.line.isNil) {
					message += `\n --> Line: ${err.line}`
				}

				if(!err.column.isNil) {
					message += `\n --> Column: ${err.column}`
				}

				throw new Error(message)
			}

			let storePath = path.relative(this.assetsPath, asset.path)
			storePath = path.join(asset.type, storePath.substr(storePath.indexOf('/')))

			let name = path.basename(storePath, path.extname(storePath))

			if(asset.compiler.wantsHashSuffixOnPublish) {
				const sha1 = crypto.createHash('md5')
				sha1.update(content)
				name += `-${sha1.digest('hex').substring(0, 8)}`
			}

			name += `.${asset.extension}`
			await this.storeAsset(asset, path.join(this.publishPath, path.dirname(storePath), name), content)
		}
	}

	async findAssets(pathname) {
		const files = await FS.recursiveReaddir(pathname)
		const ignoreFiles = files.filter(file => path.basename(file) === '.assetsignore')
		const ignoreRules = Ignore().add([ '**/_*', '**/.*' ])

		for(const ignoreFile of ignoreFiles) {
			const content = await FS.readFile(ignoreFile).then(content => content.toString())
			const dirname = path.relative(pathname, path.dirname(ignoreFile))

			const rules = content.split(/[\n\r]+/).filter(line => {
				line = line.trim()
				return line.length > 0 && line.substring(0, 1) !== '#'
			}).map(line => {
				if(line.substring(0, 1) === '!') {
					return `!${path.join(dirname, line.substring(1))}`
				}

				return path.join(dirname, line)
			})

			ignoreRules.add(rules)
		}

		return files.filter(file => {
			if(ignoreRules.filter([ path.relative(pathname, file) ]).length !== 1) {
				return false
			}

			if(!this.factory.isPathSupported(file)) {
				this.comment('Skipping unsupported asset', path.relative(this.app.paths.base(), file))
				return false
			}

			return true
		}).map(file => this.factory.make(file))
	}

	loadOldAssets() {
		return this.app.config.get('assets-published')
	}

	async storeAsset(asset, file, contents) {
		await FS.mkdirp(path.dirname(file))

		if(!(contents instanceof Buffer)) {
			contents = new Buffer(contents)
		}

		contents = await this.postProcess(asset, file, contents)

		await FS.writeFile(file, contents)
		const lastModified = await asset.lastModified()

		if(!lastModified.isNil) {
			await FS.touch(file, lastModified)
		}

		const src = path.relative(this.resourcesPath, asset.path)
		const dest = path.relative(this.publishPath, file)
		this.assets[src] = dest

		if(this.oldAssets[src] === dest) {
			delete this.oldAssets[src]
		}
	}

	async postProcess(asset, file, contents) {
		const postProcessors = this.factory.getPostProcessorsFromPath(file)

		if(postProcessors.length === 0) {
			return contents
		}

		for(const postProcessor of postProcessors) {
			this.comment(`Applying ${postProcessor.constructor.name}`, path.relative(this.app.paths.base(), asset.path))
			contents = await postProcessor.process(asset.path, file, contents)

			if(!(contents instanceof Buffer)) {
				contents = new Buffer(contents)
			}
		}

		return contents
	}

	async removeAssets(assets) {
		for(const key of Object.keys(assets)) {
			await this.removeAsset(assets[key])
		}
	}

	async writeConfig(config) {
		await FS.writeFile(
			this.app.paths.config('assets-published.json'),
			JSON.stringify(config, null, ' ')
		)
	}

}
