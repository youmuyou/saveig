const fs = require('fs')
const path = require('path')
const request = require('request-promise')
const ProgressBar = require('progress');

const base = 'https://www.instagram.com/';
const api = `${base}graphql/query/?query_id=17888483320059182&variables=%7B%22id%22%3A%22{owner}%22%2C%22first%22%3A12%2C%22after%22%3A%22{cursor}%22%7D`

const username = process.argv[2]

if (!username) {
  console.log('node save.js {username}')
  process.exit()
}

const savedir = './photos/'

try {
  fs.mkdirSync(savedir)
} catch (e) {
}

class Save {
  constructor(username) {
    this.username = username
    this.cursor = ''
    this.hasNext = true
    this.owner = null
    this.bar = null
  }

  pipe(src, dest) {
    return new Promise(function(resolve, reject) {
       request(src).pipe(fs.createWriteStream(dest))
        .on('finish', resolve)
        .on('error', reject)
    })
  }

  async getOwner() {
    const result = await request(base + this.username)
    const match = result.match(/"id": "(\d+)"/)
    return match[1]
  }

  async download() {
    if (this.owner === null) {
      this.owner = await this.getOwner()
    }

    const url = api.replace(/{owner}/, this.owner)
      .replace(/{cursor}/, this.cursor)

    try {
      const json = await request(url)
      const obj = JSON.parse(json)
      const media = obj.data.user.edge_owner_to_timeline_media
      this.hasNext = media.page_info.has_next_page
      this.cursor = media.page_info.end_cursor
      const edges = media.edges
      const pipes = []
      if (this.bar === null) {
         this.bar = new ProgressBar(':bar', { total: media.count });
      }

      edges.forEach(async edge => {
        const id = edge.node.id
        const ext = path.extname(edge.node.display_url)
        const fullpath = savedir + id + ext
        pipes.push(this.pipe(edge.node.display_url, fullpath))
      })

      const photos = await Promise.all(pipes)
      photos.forEach(_ => {
        this.bar.tick()
      })
      if (this.bar.complete) {
        console.log('done')
      }
     } catch (e) {
       console.log(e)
     }

     if (this.hasNext) {
       await this.download()
     }
  }
}

(async function() {
  const save = new Save(username)
  await save.download()
})()
