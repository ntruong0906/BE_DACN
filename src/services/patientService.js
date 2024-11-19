import _ from "lodash";
import db from "../models/index";
import emailService from "./emailService"
import { v4 as uuidv4 } from 'uuid';
import { Sequelize } from "sequelize";
const op = Sequelize.Op
require('dotenv').config()

let postBookAppointmentService = (data) => {
    return new Promise(async(resolve, reject) => {
        try {
            if (!data.email || !data.doctorId || !data.timeType
                || !data.date || !data.fullName || !data.address || !data.selectedGender ) {
                resolve({
                    errCode: 1,
                    errMessage: 'Missing required parameters!'
                })
            } else {
                let token = uuidv4()

                let scheduleBookingData = await db.Schedule.findOne({
                    where: {
                        doctorId: data.doctorId,
                        timeType: data.timeType,
                        date: data.date,
                    },
                    raw: false,
                    nest: true
                })

                

                if (scheduleBookingData && scheduleBookingData.currentNumber >= scheduleBookingData.maxNumber) {
                    resolve({
                        errCode: 2,
                        errMessage: 'Full patient booking in this time!'
                    })
                    return;
                }
                //upsert patient
                let findBookingCheck = await db.Booking.findOne({
                    where: {
                        doctorId: data.doctorId,
                        date: data.date,
                    },
                    include: [
                        {
                            model: db.User, as: 'patientData',
                            where: {
                                email: data.email
                            },
                            
                        },
                    ],
                    raw: false,
                    nest: true
                })

                if (findBookingCheck) {
                    resolve({
                        errCode: 3,
                        errMessage: 'You can only book one appointment per day!'
                    })
                    return;
                }

                let user = await db.User.findOrCreate({
                    where: {email: data.email},
                    defaults: {
                        email: data.email,
                        roleId: 'R3',
                        address: data.address,
                        gender: data.selectedGender,
                        firstName: data.fullName
                    },
                })

                //create booking record
                if (user && user[0]) {
                    let bookingObj = await db.Booking.findOrCreate({
                        where: { patientId: user[0].id, date: data.date, doctorId: data.doctorId },
                        defaults: {
                            statusId: 'S1',
                            doctorId : data.doctorId,
                            patientId : user[0].id,
                            date : data.date,
                            timeType: data.timeType,
                            token: token
                        }
                    })

                    scheduleBookingData.currentNumber = scheduleBookingData.currentNumber + 1

                    await scheduleBookingData.save()

                    if (bookingObj[0].token === token) {
                        await emailService.sendSimpleEmail({
                            receiverEmail: data.email,
                            patientName: data.fullName,
                            time: data.timeString,
                            doctorName: data.doctorName,
                            language: data.language,
                            redirectLink: buildUrlEmail(data.doctorId, token)
                        })
                    }
                }

                resolve({
                    errCode: 0,
                    errMessage: 'Save book appointment succeed!'
                })
            }
        } catch (e) {
            reject(e)
        }
    })
}

let buildUrlEmail = (doctorId, token) => {
    let result = `${process.env.URL_REACT}/verify-booking?token=${token}&doctorId=${doctorId}`
    return result
}

let postVerifyBookAppointmentService = (data) => {
    return new Promise(async(resolve, reject) => {
        try {
            if (!data.token || !data.doctorId) {
                resolve({
                    errCode: 1,
                    errMessage: 'Missing required parameters!'
                })
            } else {
                let appointment = await db.Booking.findOne({
                    where: { doctorId: data.doctorId, token: data.token, statusId: 'S1' },
                    raw: false //must be to update
                })

                if (appointment) {
                    appointment.statusId = 'S2'
                    await appointment.save()

                    resolve({
                        errCode: 0,
                        errMessage: 'Update the status appointment succeed!'
                    })
                } else {
                    resolve({
                        errCode: 2,
                        errMessage: 'Appointment has been activated or does not exist!'
                    })
                }
            }
        } catch (e) {
            reject(e)
        }
    })
}

module.exports = {
    postBookAppointmentService: postBookAppointmentService,
    postVerifyBookAppointmentService: postVerifyBookAppointmentService
}