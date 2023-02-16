const { network, ethers } = require("hardhat")
const { developmentChains, networkConfig } = require("../helper-hardhat-config")
const { verify } = require("../utils/verify")
const { storeImages, storeTokenUriMetadata } = require("../utils/uploadToPinata")

const imagesLocation = "./images/randomNft/"
let tokenUris = [
    "ipfs://QmZMrSUiYFWUJfWM4DPnssxYSZYsqjGPt9cnDLMQD6GGdQ",
    "ipfs://QmcowNmkHWmmQgHZKFMKDqYnM97XDzv5zE25jA5NkNc9QJ",
    "ipfs://QmXwdiwqCmRXg7P5dCFJ2L7F1p1cvgr9E6U2dZUBpG4Hhi",
]
const metadataTemplate = {
    name: "",
    description: "",
    images: "",
    attributes: [
        {
            trait_types: "Cuteness",
            value: 100,
        },
    ],
}

module.exports = async function ({ getNamedAccounts, deployments }) {
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()
    const chainId = network.config.chainId

    //get the IPFS hashes of our Images
    if (process.env.UPLOAD_TO_PINATA == "true") {
        tokenUris = await handleTokenUris()
    }

    const FUND_AMOUNT = "1000000000000000000000"
    let vrfCoordinatorV2Address, subscriptionId, vrfCoordinatorV2Mock

    if (developmentChains.includes(network.name)) {
        vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock")
        vrfCoordinatorV2Address = vrfCoordinatorV2Mock.address
        const tx = await vrfCoordinatorV2Mock.createSubscription()
        const txReceipt = await tx.wait(1)
        subscriptionId = txReceipt.events[0].args.subId
        await vrfCoordinatorV2Mock.fundSubscription(subscriptionId, FUND_AMOUNT)
    } else {
        vrfCoordinatorV2Address = networkConfig[chainId].vrfCoordinatorV2
        subscriptionId = networkConfig[chainId].subscriptionId
    }

    log("-----------------------------------------------------------")

    const args = [
        vrfCoordinatorV2Address,
        subscriptionId,
        networkConfig[chainId].gasLane,
        networkConfig[chainId].mintFee,
        networkConfig[chainId].callbackGasLimit,
        tokenUris,
    ]
    const randomipfsNft = await deploy("RandomIpfsNft", {
        //we are deploying our contract by uploading the token uri in the contract
        from: deployer,
        args: args,
        log: true,
        waitConfirmations: network.config.blockConfirmations || 1,
    })
    log("-----------------------------------------------------------")

    if (chainId == 31337) {
        await vrfCoordinatorV2Mock.addConsumer(subscriptionId, randomipfsNft.address)
    }

    // Verify the deployment
    if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
        log("Verifying...")
        await verify(randomipfsNft.address, args)
    }
}

async function handleTokenUris() {
    tokenUris = []
    //Store the Image in IPFS
    //Store the metadata in IPFS
    const { responses: imageUploadResponses, files } = await storeImages(imagesLocation)
    for (let imageUploadResponseIndex in imageUploadResponses) {
        //create metadata
        //upload the metadata
        let tokenUriMetadata = { ...metadataTemplate } //... means unpacked
        tokenUriMetadata.name = files[imageUploadResponseIndex].replace(".png", "") //token meta data is going to leave the extension(replace .png with nothing)
        tokenUriMetadata.description = `An adorable ${tokenUriMetadata.name} pup!`
        tokenUriMetadata.image = `ipfs://${imageUploadResponses[imageUploadResponseIndex].IpfsHash}`
        console.log(`Uploading ${tokenUriMetadata.name}...`)
        //store the JSON to pinata /IPFS
        const metadataUploadResponse = await storeTokenUriMetadata(tokenUriMetadata)
        tokenUris.push(`ipfs://${metadataUploadResponse.IpfsHash}`)
    }
    console.log("Token URIs Uploaded!They are:")
    console.log(tokenUris)
    return tokenUris
}

module.exports.tags = ["all", "randomipfs", "main"]
