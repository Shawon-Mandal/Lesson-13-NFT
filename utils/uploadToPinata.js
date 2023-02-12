const pinataSDK = require("@pinata/sdk")
const path = require("path")
const fs = require("fs") //we are using this to read our files
require("dotenv").config()

const pinataApiKey = process.env.PINATA_API_KEY
const pinataApiSecret = process.env.PINATA_API_SECRET
const pinata = new pinataSDK(pinataApiKey, pinataApiSecret)

async function storeImages(imagesFilePath) {
    //Filter the files in case there is a file that is not a .png

    const fullImagesPath = path.resolve(imagesFilePath) //this will give the full output of the path
    const files = fs.readdirSync(fullImagesPath).filter((file) => file.includes(".png")) //this is going to read the whole directory and give our files back
    let responses = []
    console.log("Uploading to Pinata")
    for (fileIndex in files) {
        console.log(`working on ${fileIndex}...`)
        const readableStreamForFile = fs.createReadStream(`${fullImagesPath}/${files[fileIndex]}`)
        try {
            const response = await pinata.pinFileToIPFS(readableStreamForFile) //pinata stuff
            responses.push(response)
        } catch (error) {
            console.log(error)
        }
    }
    return { responses, files }
}
async function storeTokenUriMetadata(metadata) {
    try {
        const response = await pinata.pinJSONToIPFS(metadata)
        return response
    } catch (error) {
        console.log(error)
    }
    return null
}

module.exports = { storeImages, storeTokenUriMetadata }
