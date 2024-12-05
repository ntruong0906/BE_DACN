import _ from "lodash";
import db from "../models/index";
import emailService from "./emailService"
import { v4 as uuidv4 } from 'uuid';
import { Sequelize } from "sequelize";
const op = Sequelize.Op
require('dotenv').config()

let postBookAppointmentService = (data) => {
    return new Promise(async (resolve, reject) => {
        try {
            if (!data.email || !data.doctorId || !data.timeType || !data.date || !data.fullName || !data.address || !data.selectedGender) {
                resolve({
                    errCode: 1,
                    errMessage: 'Missing required parameters!'
                });
            } else {
                let token = uuidv4();

                // Lấy thông tin lịch làm việc
                let scheduleBookingData = await db.Schedule.findOne({
                    where: {
                        doctorId: data.doctorId,
                        timeType: data.timeType,
                        date: data.date
                    },
                    raw: false
                });

                // Kiểm tra nếu đầy lịch
                if (scheduleBookingData && scheduleBookingData.currentNumber >= scheduleBookingData.maxNumber) {
                    resolve({
                        errCode: 2,
                        errMessage: 'Full patient booking in this time!'
                    });
                    return;
                }

                // Kiểm tra lịch hẹn đã tồn tại ở trạng thái `S1`, `S2`
                let existingBooking = await db.Booking.findOne({
                    where: {
                        doctorId: data.doctorId,
                        date: data.date,
                        statusId: {
                            [op.or]: ['S1', 'S2'] // Đang chờ xác nhận hoặc đã xác nhận
                        }
                    },
                    include: [
                        {
                            model: db.User,
                            as: 'patientData',
                            where: { email: data.email }
                        }
                    ],
                    raw: false
                });

                if (existingBooking) {
                    resolve({
                        errCode: 3,
                        errMessage: 'You can only book one appointment per day!'
                    });
                    return;
                }

                // Kiểm tra lịch hẹn đã bị hủy (S4)
                let canceledBooking = await db.Booking.findOne({
                    where: {
                        doctorId: data.doctorId,
                        date: data.date,
                        statusId: 'S4' // Lịch hẹn đã hủy
                    },
                    include: [
                        {
                            model: db.User,
                            as: 'patientData',
                            where: { email: data.email }
                        }
                    ],
                    raw: false
                });

                if (canceledBooking) {
                    // Khôi phục lịch hẹn từ S4 sang S1
                    canceledBooking.statusId = 'S1';
                    canceledBooking.token = token; // Cập nhật token mới
                    await canceledBooking.save();

                    resolve({
                        errCode: 0,
                        errMessage: 'Re-booking succeed! Appointment restored.',
                        bookingId: canceledBooking.id
                    });

                    return;
                }

                // Thêm lịch hẹn mới nếu không có lịch hẹn bị hủy
                let user = await db.User.findOrCreate({
                    where: { email: data.email },
                    defaults: {
                        email: data.email,
                        roleId: 'R3',
                        address: data.address,
                        gender: data.selectedGender,
                        firstName: data.fullName
                    }
                });

                if (user && user[0]) {
                    let bookingObj = await db.Booking.create({
                        statusId: 'S1',
                        doctorId: data.doctorId,
                        patientId: user[0].id,
                        date: data.date,
                        timeType: data.timeType,
                        token: token
                    });

                    // Tăng số lượng đặt lịch
                    scheduleBookingData.currentNumber += 1;
                    await scheduleBookingData.save();

                    // Gửi email xác nhận
                    await emailService.sendSimpleEmail({
                        receiverEmail: data.email,
                        patientName: data.fullName,
                        time: data.timeString,
                        doctorName: data.doctorName,
                        language: data.language,
                        redirectLink: buildUrlEmail(data.doctorId, token)
                    });

                    resolve({
                        errCode: 0,
                        errMessage: 'Save book appointment succeed!',
                        bookingId: bookingObj.id
                    });
                }
            }
        } catch (e) {
            reject(e);
        }
    });
};



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