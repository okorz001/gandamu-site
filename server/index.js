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
    return router
}

async function mongoMiddleware(req, res, next) {
    const data = await readFile(DB_CREDS_PATH)
    const {url, user, password} = JSON.parse(data)
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

async function getAppearances(req, res, next) {
    const db = await req.mongo.db('gundam')
    const col = await db.collection('appearances')
    const cur = await col.find()
    const data = await cur.toArray()
    res.json(data)
    next()
}

async function getConfig(req, res, next) {
    const db = await req.mongo.db('gundam')
    const col = await db.collection('config')
    const data = await col.findOne({})
    res.json(data)
    next()
}

main().catch(console.error)
