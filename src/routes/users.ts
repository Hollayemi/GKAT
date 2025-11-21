/* eslint-disable no-unused-vars */
/* eslint-disable node/no-unsupported-features/es-syntax */
const express = require('express');

exports.errorHandler = (err, req, res, next) => {
    try {
        if (process.env.NODE_ENV === 'production') {
            if (err.status === 412) {
                return res
                    .status(err.status)
                    .json({ success: false, message: err.message, type: 'error' });
            }
            return res
                .status(err.status || 400)
                .json({ success: false, message: 'An error occured', type: 'error' });
        }
        return res
            .status(err.status || 400)
            .json({ success: false, message: err.message, err, type: 'error' });
    } catch (error) {
        return res
            .status(error.status || 400)
            .json({ success: false, message: error.message, type: 'error' });
    }
};

// Not found route
exports.handle404 = (req, res) =>
    res
        .status(404)
        .json({ success: false, message: 'Route not found', type: 'error' });

exports.jsonPayload = (err, req, res) => {
    if (err.type && err.type === 'entity.parse.failed') {
        return res.status(400).errorMessage('Invalid JSON payload passed.');
    }
    // logger.error(
    //   err.response
    //     ? [err.response.data.toString().split("\n")[0], req.originalUrl].join()
    //     : err.stack
    //     ? [err.toString().split("\n")[0], req.originalUrl].join()
    //     : [err.toString().split("\n")[0], req.originalUrl].join()
    // );

    return (
        res &&
        res.status(err.response.status || 500).send({
            mesage: 'Internal Server Error',
            type: 'error',
            description: `Something broke!. Check application logs for helpful tips. OriginalUrl: ${req.originalUrl}  `,
        })
    );
};

exports.customExpress = Object.create(express().response, {
    data: {
        value(data, message = 'success') {
            return this.type('json').json({
                type: 'success',
                data,
                message,
            });
        },
    },

    success: {
        value(message = 'success') {
            return this.type('json').json({
                type: 'success',
                message,
            });
        },
    },

    error: {
        // eslint-disable-next-line default-param-last
        value(error, message = 'An error occured', code) {
            return this.status(code || 500).json({
                message,
                statusCode: -3,
                type: 'error',
                error,
            });
        },
    },

    errorMessage: {
        // eslint-disable-next-line default-param-last
        value(message = 'API response message', style = {}, code) {
            return this.status(code || 400).json({
                message,
                ...style,
                statusCode: 1,
                type: 'error',
            });
        },
    },
});
