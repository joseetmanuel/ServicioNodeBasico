var nodemailer = require('nodemailer');
// email sender function
exports.sendEmail = function(req, res){
    // Definimos el transporter
    var transporter = nodemailer.createTransport({
        service: 'Gmail',
        auth: {
            user: 'appgrupoandrade@gmail.com',
            pass: 'Andrade13*123'
        }
    });
// Definimos el email
var mailOptions = {
    from: 'AppAndrade',
    to: req.email,
    subject: 'Recupera Password',
    text: req.body
};
// Enviamos el email
transporter.sendMail(mailOptions, function(error, info){
    if (error){
        console.log(error);
        res.send(500, err.message);
    } else {
        res.status(200).jsonp(req.body);
    }
});
};