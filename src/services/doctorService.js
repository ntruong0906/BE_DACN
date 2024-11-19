import _ from "lodash";
import db from "../models/index";
require('dotenv').config()
import emailService from '../services/emailService'

const MAX_NUMBER_SCHEDULE = process.env.MAX_NUMBER_SCHEDULE

let getTopDoctorHomeService = (limitInput) => {
    return new Promise(async(resolve, reject) => {
        try {
            let users = await db.User.findAll({
                limit: limitInput,
                where: {roleId: 'R2'},
                order: [['createdAt', 'DESC']],
                attributes: { exclude: ['password'] },
                include: [
                    { model: db.Allcode, as: 'positionData', attributes: ['valueEn', 'valueVi'] },
                    { model: db.Allcode, as: 'genderData', attributes: ['valueEn', 'valueVi'] },
                    {
                        model: db.Doctor_Info,
                        include: [
                            { model: db.Specialty, attributes: ['name'] },
                        ]
                    },
                ],
                raw: true,
                nest: true
            })
            resolve({
                errCode: 0,
                data: users
            })
        } catch (e) {
            reject(e)
        }
    })
}

let getAllDoctorsService = () => {
    return new Promise(async(resolve, reject) => {
        try {
            let doctors = await db.User.findAll({
                where: { roleId: 'R2' },
                attributes: { exclude: ['password', 'image'] },
            })

            resolve({
                errCode: 0,
                data: doctors
            })
        } catch (e) {
            reject(e)
        }
    })
}

let checkRequiredField = (inputData) => {
    let arr = ['doctorId', 'contentHTML', 'contentMarkdown', 'action', 'selectedPrice', 'selectedPayment',
        'selectedProvince', 'nameClinic', 'addressClinic', 'note', 'specialtyId'
    ]
    let isValid = true
    let element = ''

    for (let i = 0; i < arr.length; i++){
        if (!inputData[arr[i]]) {
            isValid = false
            element = arr[i]
            break
        }
    }
    return {
        isValid: isValid,
        element: element
    }
}

let postInfoDoctorsService = (inputData) => {
    return new Promise(async(resolve, reject) => {
        try {
            let checkObj = checkRequiredField(inputData)
            if (checkObj.isValid === false) {
                resolve({
                    errCode: 1,
                    errMessage: `Missing required parameters: ${checkObj.element}!`
                })
            } else {
                //update-insert to Markdown
                if (inputData.action === 'CREATE') {
                    await db.Markdown.create({
                        contentHTML: inputData.contentHTML,
                        contentMarkdown: inputData.contentMarkdown,
                        description: inputData.description,
                        doctorId: inputData.doctorId
                    })
                } else if (inputData.action === 'EDIT') {
                    let doctorMarkdown = await db.Markdown.findOne({
                        where: { doctorId: inputData.doctorId },
                        raw: false
                    })
                    if (doctorMarkdown) {
                        doctorMarkdown.contentHTML = inputData.contentHTML
                        doctorMarkdown.contentMarkdown = inputData.contentMarkdown
                        doctorMarkdown.description = inputData.description
                        await doctorMarkdown.save()
                    }
                }

                //update-insert to Doctor-info table
                let doctorInfo = await db.Doctor_Info.findOne({
                    where: { doctorId: inputData.doctorId },
                    raw: false
                })

                if (doctorInfo) {
                    //update
                    doctorInfo.doctorId = inputData.doctorId
                    doctorInfo.priceId = inputData.selectedPrice
                    doctorInfo.paymentId = inputData.selectedPayment
                    doctorInfo.provinceId = inputData.selectedProvince
                    doctorInfo.nameClinic = inputData.nameClinic
                    doctorInfo.addressClinic = inputData.addressClinic
                    doctorInfo.note = inputData.note
                    doctorInfo.specialtyId = inputData.specialtyId
                    doctorInfo.clinicId = inputData.clinicId
                    await doctorInfo.save()
                } else {
                    //create
                    await db.Doctor_Info.create({
                        doctorId: inputData.doctorId,
                        priceId : inputData.selectedPrice,
                        paymentId : inputData.selectedPayment,
                        provinceId : inputData.selectedProvince,
                        nameClinic : inputData.nameClinic,
                        addressClinic : inputData.addressClinic,
                        note: inputData.note,
                        specialtyId: inputData.specialtyId,
                        clinicId: inputData.clinicId
                    })
                }
                
                resolve({
                    errCode: 0,
                    errMessage: 'Save info doctor succeed!'
                })
            }
        } catch (e) {
            reject(e)
        }
    })
}

let getDetailDoctorByIdService = (inputId) => {
    return new Promise(async(resolve, reject) => {
        try {
            if (!inputId) {
                resolve({
                    errCode: 1,
                    errMessage: 'Missing required parameters!'
                })
            } else {
                let data = await db.User.findOne({
                    where: { id: inputId },
                    attributes: { exclude: ['password'] },
                    include: [
                        { model: db.Markdown, attributes: ['description', 'contentHTML', 'contentMarkdown'], },
                        { model: db.Allcode, as: 'positionData', attributes: ['valueEn', 'valueVi'] },
                        {
                            model: db.Doctor_Info,
                            include: [
                                { model: db.Allcode, as: 'priceTypeData', attributes: ['valueEn', 'valueVi'] },
                                { model: db.Allcode, as: 'paymentTypeData', attributes: ['valueEn', 'valueVi'] },
                                { model: db.Allcode, as: 'provinceTypeData', attributes: ['valueEn', 'valueVi'] },
                            ]
                        },
                    ],
                    raw: false, 
                    nest: true
                })

                if (data && data.image) {
                    data.image = new Buffer(data.image, 'base64').toString('binary')
                }

                if(!data) data = {}

                resolve({
                    errCode: 0,
                    data: data
                })
            }
        } catch (e) {
            reject(e)
        }
    })
}

let postScheduleDoctorsService = (data) => {
    return new Promise(async(resolve, reject) => {
        try {
            if (!data.arrSchedule || !data.doctorId || !data.formatedDate) {
                resolve({
                    errCode: 1,
                    errMessage: 'Missing required parameters!'
                })
            } else {
                let schedule = data.arrSchedule
                if (schedule && schedule.length > 0) {
                    schedule = schedule.map(item => {
                        item.maxNumber = MAX_NUMBER_SCHEDULE
                        return item
                    })
                }
                //get all existing data
                let existing = await db.Schedule.findAll({
                    where: { doctorId: data.doctorId, date: data.formatedDate },
                    attributes: ['timeType', 'date', 'doctorId', 'maxNumber'],
                    raw: true
                })
                
                //compare diff data
                let toCreate = _.differenceWith(schedule, existing, (a, b) => {
                    return a.timeType === b.timeType && +a.date === +b.date
                })
                //create data
                if (toCreate && toCreate.length > 0) {
                    await db.Schedule.bulkCreate(toCreate)
                }
                resolve({
                    errCode: 0,
                    errMessage: 'OK'
                })
            }
        } catch (e) {
            reject(e)
        }
    })
}

let getScheduleDoctorByDateService = (doctorId, date) => {
    return new Promise(async(resolve, reject) => {
        try {
            if (!doctorId || !date) {
                resolve({
                    errCode: 1,
                    errMessage: 'Missing required parameters!'
                })
            } else {
                let dataSchedule = await db.Schedule.findAll({
                    where: { doctorId: doctorId, date: date },
                    include: [
                        { model: db.Allcode, as: 'timeTypeData', attributes: ['valueEn', 'valueVi'] },
                        { model: db.User, as: 'doctorData', attributes: ['firstName', 'lastName'] }
                    ],
                    raw: false, 
                    nest: true
                })

                if (!dataSchedule) dataSchedule = []
                resolve({
                    errCode: 0,
                    data: dataSchedule
                })
            }
        } catch (e) {
            reject(e)
        }
    })
}
    
let getExtraInfoDoctorByIdService = (inputId) => {
    return new Promise(async(resolve, reject) => {
        try {
            if (!inputId) {
                resolve({
                    errCode: 1,
                    errMessage: 'Missing required parameters!'
                })
            } else {
                let data = await db.Doctor_Info.findOne({
                    where: { doctorId: inputId },
                    attributes: { exclude: ['id', 'doctorId'] },
                    include: [
                        { model: db.Allcode, as: 'priceTypeData', attributes: ['valueEn', 'valueVi'] },
                        { model: db.Allcode, as: 'paymentTypeData', attributes: ['valueEn', 'valueVi'] },
                        { model: db.Allcode, as: 'provinceTypeData', attributes: ['valueEn', 'valueVi'] },
                    ],
                    raw: false, 
                    nest: true
                })

                if(!data) data = {}

                resolve({
                    errCode: 0,
                    data: data
                })
            }
        } catch (e) {
            reject(e)
        }
    })
}

let getProfileDoctorByIdService = (inputId) => {
    return new Promise(async(resolve, reject) => {
        try {
            if (!inputId) {
                resolve({
                    errCode: 1,
                    errMessage: 'Missing required parameters!'
                })
            } else {
                let data = await db.User.findOne({
                    where: { id: inputId },
                    attributes: { exclude: ['password'] },
                    include: [
                        { model: db.Markdown, attributes: ['description', 'contentHTML', 'contentMarkdown'], },
                        { model: db.Allcode, as: 'positionData', attributes: ['valueEn', 'valueVi'] },
                        {
                            model: db.Doctor_Info,
                            include: [
                                { model: db.Allcode, as: 'priceTypeData', attributes: ['valueEn', 'valueVi'] },
                                { model: db.Allcode, as: 'paymentTypeData', attributes: ['valueEn', 'valueVi'] },
                                { model: db.Allcode, as: 'provinceTypeData', attributes: ['valueEn', 'valueVi'] },
                            ]
                        },
                    ],
                    raw: false,
                    nest: true
                })

                if (data && data.image) {
                    data.image = new Buffer(data.image, 'base64').toString('binary')
                }

                if (!data) data = {}

                resolve({
                    errCode: 0,
                    data: data
                })
            }
        } catch (e) {
            reject(e)
        }
    })
}

let getListPatientForDoctorService = (doctorId, date, statusId) => {
    return new Promise(async(resolve, reject) => {
        try {
            if (!doctorId || !date || !statusId) {
                resolve({
                    errCode: 1,
                    errMessage: 'Missing required parameters!'
                })
            } else {
                if (statusId === 'ALL') {
                    let data = await db.Booking.findAll({
                        where: {
                            doctorId: doctorId,
                            date: date,
                        },
                        include: [
                            {
                                model: db.User,
                                as: 'patientData',
                                attributes: ['email', 'firstName', 'address', 'gender'],
                                include: [
                                    { model: db.Allcode, as: 'genderData', attributes: ['valueEn', 'valueVi'] }
                                ]
                            },
                            { model: db.Allcode, as: 'timeTypeDataPatient', attributes: ['valueEn', 'valueVi'] },
                            { model: db.Allcode, as: 'statusTypeDataPatient', attributes: ['valueEn', 'valueVi'] }
                        ],
                        
                        raw: false, 
                        nest: true
                    })

                    resolve({
                        errCode: 0,
                        data: data
                    })
                }
                if(statusId && statusId !== 'ALL'){
                    let data = await db.Booking.findAll({
                        where: {
                            doctorId: doctorId,
                            date: date,
                            statusId: statusId
                        },
                        include: [
                            {
                                model: db.User,
                                as: 'patientData',
                                attributes: ['email', 'firstName', 'address', 'gender'],
                                include: [
                                    { model: db.Allcode, as: 'genderData', attributes: ['valueEn', 'valueVi'] }
                                ]
                            },
                            { model: db.Allcode, as: 'timeTypeDataPatient', attributes: ['valueEn', 'valueVi'] },
                            { model: db.Allcode, as: 'statusTypeDataPatient', attributes: ['valueEn', 'valueVi'] }
                        ],
                        
                        raw: false, 
                        nest: true
                    })

                    resolve({
                        errCode: 0,
                        data: data
                    })
                }
            }
        } catch (e) {
            reject(e)
        }
    })
}

// let getListPatientForDoctorService = (doctorId, date) => {
//     return new Promise(async(resolve, reject) => {
//         try {
//             if (!doctorId || !date) {
//                 resolve({
//                     errCode: 1,
//                     errMessage: 'Missing required parameters!'
//                 })
//             } else {
//                 let data = await db.Booking.findAll({
//                     where: {
//                         doctorId: doctorId,
//                         date: date,
//                     },
//                     include: [
//                         {
//                             model: db.User,
//                             as: 'patientData',
//                             attributes: ['email', 'firstName', 'address', 'gender'],
//                             include: [
//                                 { model: db.Allcode, as: 'genderData', attributes: ['valueEn', 'valueVi'] }
//                             ]
//                         },
//                         { model: db.Allcode, as: 'timeTypeDataPatient', attributes: ['valueEn', 'valueVi'] },
//                         { model: db.Allcode, as: 'statusTypeDataPatient', attributes: ['valueEn', 'valueVi'] }
//                     ],
                    
//                     raw: false, 
//                     nest: true
//                 })

//                 resolve({
//                     errCode: 0,
//                     data: data
//                 })
//             }
//         } catch (e) {
//             reject(e)
//         }
//     })
// }

let sendRemedyService = (data) => {
    return new Promise(async(resolve, reject) => {
        try {
            if (!data.email || !data.doctorId || !data.patientId || !data.timeType || !data.imageBase64) {
                resolve({
                    errCode: 1,
                    errMessage: 'Missing required parameters!'
                })
            } else {
                //update patient status
                let appointment = await db.Booking.findOne({
                    where: {
                        doctorId: data.doctorId,
                        patientId: data.patientId,
                        timeType: data.timeType,
                        statusId: 'S2'
                    },
                    raw: false
                })
                if (appointment) {
                    appointment.statusId = 'S3'
                    await appointment.save()
                }
                
                //send email remedy
                await emailService.sendAttachment(data)
                resolve({
                    errCode: 0,
                    errMessage: 'OK'
                })
            }
        } catch (e) {
            reject(e)
        }
    })
}

let cancelPatientService = (data) => {
    return new Promise(async(resolve, reject) => {
        try {
            if (!data.doctorId || !data.patientId) {
                resolve({
                    errCode: 1,
                    errMessage: 'Cancel appointment failed!'
                })
            } else {
                //update patient status
                let appointment = await db.Booking.findOne({
                    where: {
                        doctorId: data.doctorId,
                        patientId: data.patientId,
                        statusId: 'S1'
                    },
                    raw: false
                })
                if (appointment) {
                    appointment.statusId = 'S4'
                    await appointment.save()
                }
                resolve({
                    errCode: 0,
                    errMessage: 'OK'
                })
            }
        } catch (e) {
            reject(e)
        }
    })
}

module.exports = {
    getTopDoctorHomeService: getTopDoctorHomeService, cancelPatientService: cancelPatientService,
    getAllDoctorsService: getAllDoctorsService,
    postInfoDoctorsService: postInfoDoctorsService,
    getDetailDoctorByIdService: getDetailDoctorByIdService,
    postScheduleDoctorsService: postScheduleDoctorsService,
    getScheduleDoctorByDateService: getScheduleDoctorByDateService,
    getExtraInfoDoctorByIdService: getExtraInfoDoctorByIdService,
    getProfileDoctorByIdService: getProfileDoctorByIdService,
    getListPatientForDoctorService: getListPatientForDoctorService,
    sendRemedyService: sendRemedyService,
}