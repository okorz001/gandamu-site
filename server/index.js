'use strict'

const asyncHandler = require('express-async-handler')
const express = require('express')
const fs = require('fs')
const {MongoClient} = require('mongodb')
const {promisify} = require('util')

const PORT = process.env.PORT || 8080

const DB_CREDS_PATH = 'secrets/db.json'

const readFile = promisify(fs.readFile)

async function main() {
    const app = express()
    app.use('/api', createApiRouter())
    app.use(express.static('assets'))
    app.use(express.static('build'))

    const listen = promisify(app.listen.bind(app))
    await listen(PORT)
    console.log(`Listening on port ${PORT}`)
}

function createApiRouter() {
    const router = express.Router()
    router.use(asyncHandler(mongoMiddleware))
    router.get('/getAppearances', asyncHandler(getAppearances))
    router.get('/getConfig', asyncHandler(getConfig))
    router.get('/getMecha', asyncHandler(getMecha))
    router.get('/getImage', asyncHandler(getImage))
    return router
}

async function mongoMiddleware(req, res, next) {
    const {url, user, password} = await getMongoCreds()
    const mongo = new MongoClient(url, {
        useNewUrlParser: true,
        auth: {user, password},
    })
    await mongo.connect()
    // finish fires on success or error
    res.on('finish', () => mongo.close())
    req.mongo = mongo
    next()
}

async function getMongoCreds() {
    try {
        return JSON.parse(await readFile(DB_CREDS_PATH))

    }
    catch (err) {
        return {
            url: process.env.DB_URL,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
        }
    }
}

async function getAppearances(req, res, next) {
    let data = await req.mongo
        .db('gundam')
        .collection('appearances')
        .find()
        .toArray()

    if (req.query.collapsed == '1') {
        const mecha = {}
        await req.mongo
            .db('gundam')
            .collection('mecha')
            .find()
            .forEach(it => mecha[it.name] = it)

        data = data.map(({series, appearances}) => {
            const collapsed = {}
            appearances.forEach(({name, episodes}) => {
                // use variant name, fall back to own name
                let key = name
                if (mecha[name] && mecha[name].variant) {
                    key = mecha[name].variant
                }
                // initialize if unset
                if (!collapsed[key]) {
                    collapsed[key] = {name: key, episodes: {}}
                }
                // merge episode sets
                Object.assign(collapsed[key].episodes, episodes)
                // update total count
                collapsed[key].total = Object.keys(collapsed[key].episodes).length
            })
            // strip key
            return {series, appearances: Object.values(collapsed)}
        })
    }

    res.json(data)
    next()
}

async function getConfig(req, res, next) {
    const data = await req.mongo
        .db('gundam')
        .collection('config')
        .findOne({})
    res.json(data)
    next()
}

async function getMecha(req, res, next) {
    const data = await req.mongo
        .db('gundam')
        .collection('mecha')
        .find()
        .toArray()
    res.json(data)
    next()
}

async function getImage(req, res, next) {
    if (!req.query.name) {
        res.status(400).send('missing parameter: name')
        next()
        return
    }
    const data = await req.mongo
        .db('gundam')
        .collection('images')
        .findOne({name: req.query.name})
    if (!data) {
        // TODO: default image
        res.status(404).send(`no image for: ${req.query.name}`)
        next()
        return
    }
    res.set('Content-Type', 'image/jpeg')
    res.send(data.image.buffer)
    next()
}

main().catch(console.error)
