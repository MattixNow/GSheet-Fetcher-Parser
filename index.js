const GoogleSpreadsheet = require("google-spreadsheet")
const { promisify } = require("util")
const axios = require("axios")
const low = require("lowdb")
const credentials = require("./client_secret.json")
const FileSync = require("lowdb/adapters/FileSync")
const url = require("url")

const adapter = new FileSync("db.json")
const db = low(adapter)

const chalk = require("chalk")

db.defaults({ plateforms: [] }).write()

require("dotenv").config()
db.set("plateforms", []).write()

var platforms = []
function addCourse(body, currentPlateform) {
    platforms.push(currentPlateform)

    let plateformUndefined = db
        .get(`plateforms`)
        .find({ name: body.plateform })
        .value()

    if (plateformUndefined == undefined) {
        db.get(`plateforms`)
            .push({ name: body.plateform })
            .write()
        db.get("plateforms")
            .find({ name: body.plateform })
            .set("courses", [])
            .write()
    }

    db.get(`plateforms`)
        .find({ name: body.plateform })
        .get("courses")
        .push(body)
        .write()

    const courseChecker = db
        .get("plateforms")
        .find({ name: body.plateform })
        .get("courses")
        .uniqBy("link")
        .value()

    db.get(`plateforms`)
        .find({ name: body.plateform })
        .set("courses", courseChecker)
        .write()
    return db.read()
}

async function accessSpreadsheet() {
    const doc = new GoogleSpreadsheet(process.env.googleSpreadSheetID)
    await promisify(doc.useServiceAccountAuth)(credentials)
    const info = await promisify(doc.getInfo)()
    const sheet = info.worksheets[0]
    console.log(chalk.green('SpreadSheet was fetched'))
    const rows = await promisify(sheet.getRows)({
        offset: 1,
        orderby: "note"
    })
    rows.forEach(element => {
        addCourse(
            {
                name: element.name,
                creator: element.creator,
                link: element.link,
                plateform: element.plateform,
                description: element.description,
                note: element.note,
                price: element.price,
                certificate: element.certificate
            },
            element.plateform
        )
    })
    let platformsList = db
        .get("plateforms")
        .map("name")
        .value()

    let difference = platformsList
        .filter(x => !platforms.includes(x))
        .concat(platforms.filter(x => !platformsList.includes(x)))
    console.log(chalk.blue("Difference between inputs : ") + difference)
    
    difference.map(x =>
        db
            .get(`plateforms`)
            .remove({ name: x })
            .write()
    )

    return db.read()
}

async function postDataBox() {
    axios({
        method: "put",
        url: `https://api.jsonbin.io/b/5df14e15bc5ffd040097c63a`,
        headers: {
            "Content-type": "application/json",
            "secret-key": process.env.jsonBinSecret
        },
        data: await accessSpreadsheet()
    })
        .then(function(response) {
            // handle success
            console.log(chalk.green("Successfully pushed to jsonbin.io"))
        })
        .catch(function(error) {
            // handle error
            console.log(error)
        })
}
postDataBox()
