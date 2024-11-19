import handbookService from "../services/handbookService";

let createHandbook = async (req, res) => {
    try {
        let info = await handbookService.createHandbookService(req.body)
        return res.status(200).json(info)
    } catch (e) {
        console.log(e)
        return res.status(200).json({
            errCode: -1,
            message: 'Error from server ...'
        })
    }
}

let getAllHandbook = async (req, res) => {
    try {
        let info = await handbookService.getAllHandbookService()
        return res.status(200).json(info)
    } catch (e) {
        console.log(e)
        return res.status(200).json({
            errCode: -1,
            message: 'Error from server ...'
        })
    }
}

let getDetailHandbookById = async (req, res) => {
    try {
        let info = await handbookService.getDetailHandbookByIdService(req.query.id)
        return res.status(200).json(info)
    } catch (e) {
        console.log(e)
        return res.status(200).json({
            errCode: -1,
            message: 'Error from server ...'
        })
    }
}

module.exports = {
    createHandbook: createHandbook,
    getAllHandbook: getAllHandbook,
    getDetailHandbookById: getDetailHandbookById
}