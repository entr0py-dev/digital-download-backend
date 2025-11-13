const sqlite3 = require("sqlite3").verbose()
const db = new sqlite3.Database("downloads.db")

function initDB() {
    return new Promise((resolve) => {
        db.run(
            `CREATE TABLE IF NOT EXISTS downloads (
                id TEXT PRIMARY KEY,
                email TEXT,
                used INTEGER DEFAULT 0,
                issuedAt TEXT
            )`,
            resolve
        )
    })
}

function hasDownloadIssued(id) {
    return new Promise((resolve, reject) => {
        db.get("SELECT id FROM downloads WHERE id = ?", [id], (err, row) => {
            if (err) return reject(err)
            resolve(!!row)
        })
    })
}

function markDownloadIssued(id, email) {
    return new Promise((resolve, reject) => {
        db.run(
            `INSERT INTO downloads (id, email, issuedAt) VALUES (?, ?, ?)`,
            [id, email, new Date().toISOString()],
            (err) => {
                if (err) return reject(err)
                resolve()
            }
        )
    })
}

module.exports = { initDB, hasDownloadIssued, markDownloadIssued }
