// importar
var express = require('express');
var sql = require('mssql');
var distance = require('google-distance-matrix');
var mailCtrl = require('./mailCtrl');
var http = require('http');
var conf = require('./config');
const querystring = require('querystring');
var bodyParser = require('body-parser');
var multer = require('multer');
var fs = require('fs');
var requestG = require('request');


// configura bd 
var config = conf.Datos;
// instanciar
var app = express();
// para datos en mensaje
app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies

// ruteo

//APP_CITAS_VALIDA_LOGIN
app.get('/Logea', function(req, res) {
    //console.log(req);
    ValidaLog(req, res, false);
});

//APP_CITAS_REGISTRAR_USUARIO
app.get('/Registra', function(req, res) {
    var dbConn = new sql.Connection(config);
    var uss = '0';
    //console.log(req.query.user+' - '+req.query.password+' - '+req.query.vin+' - '+req.query.placas);
    dbConn.connect().then(function() {
        var request = new sql.Request(dbConn);

        request
            .input('nombreUsuario', req.query.user)
            .input('contrasenia', req.query.password)
            .input('vin', req.query.vin)
            .input('placas', req.query.placas)
            .input('telefonoUsuario', req.query.tel)
            .input('nombreCompleto', req.query.nombre)
            .input('correoElectronico', req.query.email)
            .execute("APP_CITAS_REGISTRAR_USUARIO").then(function(recordSet) {
                //console.log(recordSet[0][0]);
                var msj = recordSet[0][0].mensaje;

                dbConn.close();
                if (msj === 'Usuario Registrado')
                    ValidaLog(req, res, false);
                else
                    regreso('0', 'sql:' + msj, res);
            }).catch(function(err) {
                dbConn.close();
                regreso('0', 'err erv:' + err.message, res);
            });
    }).catch(function(err) {
        dbConn.close();
        regreso('0', err.message, res);
    });
});

function regreso(id, mensaje, res) {
    //console.log(id+' - '+mensaje);
    var SendObj = { "idUsr": id, "Msj": mensaje };
    var stringData = JSON.stringify(SendObj);

    // Indicamos el tipo de contenido a devolver en las cabeceras de nuestra respuesta
    res.contentType('application/json');
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");

    res.send(stringData);
}

function Param() {
    this.App;
    this.VinPlaca;
}
/* Valida el Login
function ValidaLog(req,res,bTaller){
	bTaller = true,  si viene de la aplicación mi taller, de lo contrario viene de MiAuto
*/

function ValidaLog(req, res, bTaller) {
    var sp = "APP_CITAS_VALIDA_LOGIN",
        app = "2";
    if (bTaller) {
        sp = "APP_CITAS_VALIDA_LOGIN_T", app = "3";
    }
    var dbConn = new sql.Connection(config);
    dbConn.connect().then(function() {
        var request = new sql.Request(dbConn);
        request
            .input('nombreUsuario', req.query.user)
            .input('contrasenia', req.query.password)
            .execute(sp).then(function(recordSet) {
                //console.log();
                var msj = recordSet[0][0];

                if (msj.mensaje != undefined) {
                    regreso('0', 'Error BD: ' + msj.mensaje, res);
                }

                dbConn.close();
                res.contentType('application/json');
                res.header("Access-Control-Allow-Origin", "*");
                res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
                var postData = querystring.stringify({
                    'App': app,
                    'idUsuario': msj.idUsuario
                });

                var confServicio = conf.Notificaciones;
                confServicio.path = "/GetNotificationMobile?" + postData;
                confServicio.method = "GET";
                confServicio.headers = {}

                // console.log(conf);
                // Se invoca el servicio RESTful con las opciones configuradas previamente y sin objeto JSON.
                invocarServicio(confServicio, null, function(data, err) {
                    // console.log(err);
                    if (err) { regreso('0', 'Error al conectar a las alertas: ' + err.message, res); } else {
                        if (msj) {
                            msj.mensajes = data;
                            res.send(JSON.stringify(msj));
                        } else {
                            regreso('0', 'No coinciden el usuario o la contraseña', res);
                        }
                    }
                });

            }).catch(function(err) {
                dbConn.close();
                regreso('0', 'Error: ' + err.message, res);
            });
    }).catch(function(err) {
        dbConn.close();
        regreso('0', 'Error: ' + err.message, res);
    });
}

/**
 * Función encargada de invocar los servicios RESTful y devolver
 * el objeto JSON correspondiente. Et
 */
function invocarServicio(options, jsonObject, next) {
    var req = http.request(options, function(res) {
        var contentType = res.headers['content-type'];
        /**
         * Variable para guardar los datos del servicio RESTfull.
         */

        var data = '';
        //console.log(data);
        res.on('data', function(chunk) {
                // Cada vez que se recojan datos se agregan a la variable
                data += chunk;
                //console.log(chunk);
            }).on('end', function() {

                // Al terminar de recibir datos los procesamos
                var response = null;
                //console.log(data);
                //console.log(options);
                // Nos aseguramos de que sea tipo JSON antes de convertirlo.
                if (contentType.indexOf('application/json') != -1 && data) {
                    response = JSON.parse(data);
                }

                // Invocamos el next con los datos de respuesta
                next(response, null);
            })
            .on('error', function(err) {
                // Si hay errores los sacamos por consola
                console.error('Error al procesar el mensaje: ' + err)
            })
            .on('uncaughtException', function(err) {
                // Si hay alguna excepción no capturada la sacamos por consola
                console.error(err);
            });
    }).on('error', function(err) {
        // Si hay errores los sacamos por consola y le pasamos los errores a next.
        console.error('HTTP request failed: ' + err);
        // console.log(req);
        next(null, err);
    });

    // Si la petición tiene datos estos se envían con la request
    if (jsonObject) {
        //console.log(jsonObject);
        req.write(jsonObject);
    }

    req.end();
};

//APP_CITAS_GET_UNIDADES
app.get('/GetUnidades', function(req, res) {
    var dbConn = new sql.Connection(config);
    dbConn.connect().then(function() {
        var request = new sql.Request(dbConn);

        request
            .input('idUsuario', req.query.idUser)
            .execute("APP_CITAS_GET_UNIDADES").then(function(recordSet) {
                var msj = recordSet[0];
                if (msj.length > 0) {
                    msj[0].Estatus = recordSet[1];
                    msj[0].Taller = recordSet[2][0];
                }
                dbConn.close();
                res.contentType('application/json');
                res.header("Access-Control-Allow-Origin", "*");
                res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");

                res.send(JSON.stringify(msj));
            }).catch(function(err) {
                dbConn.close();
                regreso('0', err.message, res);
            });
    }).catch(function(err) {
        dbConn.close();
        regreso('0', err.message, res);
    });
});


//APP_CITAS_GET_UNIDADES
app.get('/GetMultas', function(req, res) {
    var dbConn = new sql.Connection(config);
    dbConn.connect().then(function() {
        var request = new sql.Request(dbConn);

        request
            .input('idUnidad', req.query.idUnidad)
            .input('dirDocs', conf.Foltillas.Documentos)
            .execute("APP_CITAS_GET_MULTAS").then(function(recordSet) {
                var msj = recordSet[0];

                dbConn.close();
                res.contentType('application/json');
                res.header("Access-Control-Allow-Origin", "*");
                res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");

                res.send(JSON.stringify(msj));
            }).catch(function(err) {
                dbConn.close();
                regreso('0', err.message, res);
            });
    }).catch(function(err) {
        dbConn.close();
        regreso('0', err.message, res);
    });
});

function _Taller() {
    this.idProveedor = "";
    this.nombreComercial = "";
    this.idTaller = "";
    this.razonSocial = "";
    this.RFC = "";
    this.direccion = "";
    this.latitud = "";
    this.longitud = "";
    this.nombre = "";
    this.calificacionTaller = "";
    this.km = "";
    this.order = 0;
}

function kilometros() {
    this.longitud = 0;
    this.latitud = 0;
    this.kilometros = -1;
    this.fecha = '';
    this.numeroEconomico = 0;
    this.placas = '';
}



//APP_CITAS_GET_TALLERES
app.get('/GetTalleres', function(req, res) {
    var dbConn = new sql.Connection(config);
    var talleres = [];
    var origins = [req.query.lat + ',' + req.query.lng];
    var destinations = [];

    dbConn.connect().then(function() {
        var request = new sql.Request(dbConn);
        request
            .input('latitudInt', Math.trunc(req.query.lat))
            .input('longitudInt', Math.trunc(req.query.lng))
            .execute("APP_CITAS_GET_TALLERES").then(function(recordSet) {
                for (var i = 0; i < recordSet[0].length; i++) {
                    var taller = new _Taller();
                    taller.idProveedor = recordSet[0][i].idProveedor;
                    taller.nombreComercial = recordSet[0][i].nombreComercial;
                    taller.idTaller = recordSet[0][i].idTaller;
                    taller.razonSocial = recordSet[0][i].razonSocial;
                    taller.RFC = recordSet[0][i].RFC;
                    taller.direccion = recordSet[0][i].direccion;
                    taller.latitud = recordSet[0][i].latitud;
                    taller.calificacionTaller = recordSet[0][i].calificacionTaller;
                    taller.order = i;
                    var longi = recordSet[0][i].longitud;
                    if (parseFloat(longi) > 0) {
                        longi = '-' + longi;
                    }
                    taller.longitud = longi;
                    talleres.push(taller);
                    destinations.push(taller.latitud + ',' + taller.longitud);
                }
                dbConn.close();
                computeTotalDistance(origins, destinations, res, 0, talleres);
            }).catch(function(err) {
                dbConn.close();
                regreso('0', err.message, res);
            });
    }).catch(function(err) {
        dbConn.close();
        regreso('0', err.message, res);
    });
});

function computeTotalDistance(origins, destinations, res, noInt, talleres) {
    distance.key('AIzaSyBfaZuXKdq-hdz8G7QAWUQ7WvVkmK_Ys3k');
    distance.mode('driving');
    var Nerr = 99999;

    distance.matrix(origins, destinations, function(err, distances) {
        /*
        console.log(origins);
        console.log(destinations);
        console.log(err);
        */
        if (distances != null && distances != undefined) {
            if (distances.status == 'OK') {
                for (var i = 0; i < origins.length; i++) {
                    for (var j = 0; j < destinations.length; j++) {
                        if (distances.rows[0].elements.length > 0) {
                            if (distances.rows[0].elements[j].status == 'OK') {
                                var distance = distances.rows[i].elements[j].distance.text;
                                //console.log(distance);
                                talleres[j].km = distance;
                                talleres[j].order = parseInt(distance.split(" ")[0]); // guardo los kilometros en entero para ordenar
                            } else {
                                talleres[j].order = Nerr;
                                Nerr = Nerr + 1;
                            }
                        }
                    }
                }
            }
            //	console.log(talleres);
            // ordenamos los talleres por distancia
            talleres.sort(function(a, b) {
                if (a.order > b.order) { return 1; }
                if (a.order < b.order) { return -1; }
                return 0;
            });
            LimpiayRespondeKM(res, talleres);
        } else {
            LimpiayRespondeKM(res, talleres);
        }
    });
}

function LimpiayRespondeKM(res, talleres) {
    var respuesta = [];
    for (var i = 0; i < talleres.length; i++) {
        if (talleres[i].order < 99999) respuesta.push(talleres[i]);
        else {
            talleres[i].km = 'Sin Dir';
            respuesta.push(talleres[i]);
        }
    }
    res.contentType('application/json');
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");

    res.send(respuesta);
}
//APP_CITAS_GET_ORDENES_POR_UNIDAD
app.get('/GetOrdXUni', function(req, res) {
    var dbConn = new sql.Connection(config);
    dbConn.connect().then(function() {
        var request = new sql.Request(dbConn);
        request
            .input('idUnidad', req.query.idUnidad)
            .execute("APP_CITAS_GET_ORDENES_POR_UNIDAD").then(function(recordSet) {
                var msj = JSON.stringify(recordSet[0]);

                dbConn.close();
                res.contentType('application/json');
                res.header("Access-Control-Allow-Origin", "*");
                res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");

                res.send(msj);
            }).catch(function(err) {
                dbConn.close();
                regreso('0', err.message, res);
            });
    }).catch(function(err) {
        dbConn.close();
        regreso('0', err.message, res);
    });
});

//[GPS].[SEL_KILOMETROS_SP]
app.get('/GetKilometros', function(req, res) {
    var dbConn = new sql.Connection(config);
    dbConn.connect().then(function() {
        var request = new sql.Request(dbConn);
        request
            .input('vin', req.query.vin)
            .execute("[GPS].[SEL_KILOMETROS_SP]").then(function(recordSet) {
                var kilOtro = JSON.stringify(recordSet[0]);

                var kil = new kilometros();
                if (recordSet[0] && recordSet[0].length > 0) {
                    kil.longitud = recordSet[0][0].longitud;
                    kil.latitud = recordSet[0][0].latitud;
                    kil.kilometros = recordSet[0][0].kilometros;
                    kil.fecha = recordSet[0][0].fecha;
                    kil.numeroEconomico = recordSet[0][0].numeroEconomico;
                    kil.placas = recordSet[0][0].placas;
                }

                dbConn.close();
                res.contentType('application/json');
                res.header("Access-Control-Allow-Origin", "*");
                res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");

                res.send(kil);
            }).catch(function(err) {
                dbConn.close();
                regreso('0', err.message, res);
            });
    }).catch(function(err) {
        dbConn.close();
        regreso('0', err.message, res);
    });
});

function doctos() {
    this.placas;
    this.tarjetaDeCirculacion;
    this.PolizaDeSeguros;
    this.PagoVerificacion;
    this.Tenencia;
    this.Verificacion;
    this.fechaVigenciaPolizaSeguro;
    this.fechaVigenciaPolizaSeguroVencida;
    this.fechaVerificacion;
    this.fechaVerificacionVencida;
    this.fechaVigenciaTenencia;
    this.fechaVigenciaTenenciaVencida;
    this.multas;
}

//APP_CITAS_GET_DOCUMENTOS_UNIDAD
app.get('/GetDocsXUni', function(req, res) {
    var dbConn = new sql.Connection(config);
    dbConn.connect().then(function() {
        var request = new sql.Request(dbConn);
        request
            .input('idUnidad', req.query.idUnidad)
            .execute("APP_CITAS_GET_DOCUMENTOS_UNIDAD").then(function(recordSet) {
                var msj = recordSet[0][0];
                //console.log(msj);
                res.contentType('application/json');
                res.header("Access-Control-Allow-Origin", "*");
                res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
                var tmp = new doctos();
                if (msj.Tenencia.length > 1) {
                    var str = msj.Tenencia;
                    str = str.split('/')[str.split('/').length - 2] + '/' + str.split('/')[str.split('/').length - 1];
                    tmp.Tenencia = conf.Foltillas.Documentos + str;
                }
                if (msj.Verificacion.length > 1) {
                    var str = msj.Verificacion;
                    str = str.split('/')[str.split('/').length - 2] + '/' + str.split('/')[str.split('/').length - 1];
                    tmp.Verificacion = conf.Foltillas.Documentos + str;
                }
                if (msj.PolizaDeSeguros.length > 1) {
                    var str = msj.PolizaDeSeguros;
                    str = str.split('/')[str.split('/').length - 2] + '/' + str.split('/')[str.split('/').length - 1];
                    tmp.PolizaDeSeguros = conf.Foltillas.Documentos + str;
                }
                if (msj.PagoVerificacion.length > 1) {
                    var str = msj.PagoVerificacion;
                    str = str.split('/')[str.split('/').length - 2] + '/' + str.split('/')[str.split('/').length - 1];
                    tmp.PagoVerificacion = conf.Foltillas.Documentos + str;
                }

                if (msj.placas.length > 1) tmp.placas = conf.Foltillas.Documentos + msj.placas;
                if (msj.tarjetaDeCirculacion.length > 1) tmp.tarjetaDeCirculacion = conf.Foltillas.Documentos + msj.tarjetaDeCirculacion;

                if (msj.fechaVigenciaPolizaSeguro != null) {
                    temporal = msj.fechaVigenciaPolizaSeguro;
                    //	console.log('fecha 1' + temporal);
                    tmp.fechaVigenciaPolizaSeguro = (temporal.getDate() < 9 ? '0' + temporal.getDate() : temporal.getDate()) + '/' + ((temporal.getMonth() + 1) < 9 ? '0' + (temporal.getMonth() + 1) : (temporal.getMonth() + 1)) + '/20' + (temporal.getYear() - 100);
                }
                tmp.fechaVigenciaPolizaSeguroVencida = msj.fechaVigenciaPolizaSeguroVencida;

                if (msj.fechaVerificacion != null) {
                    var temporal = '';
                    temporal = msj.fechaVerificacion;
                    //	console.log('fecha 2' + temporal);
                    tmp.fechaVerificacion = (temporal.getDate() < 9 ? '0' + temporal.getDate() : temporal.getDate()) + '/' + ((temporal.getMonth() + 1) < 9 ? '0' + (temporal.getMonth() + 1) : (temporal.getMonth() + 1)) + '/20' + (temporal.getYear() - 100);
                }
                tmp.fechaVerificacionVencida = msj.fechaVerificacionVencida;

                if (msj.fechaVigenciaTenencia != null) {
                    var temporal = '';
                    temporal = msj.fechaVigenciaTenencia;
                    //	console.log('fecha 3' + temporal);
                    tmp.fechaVigenciaTenencia = (temporal.getDate() < 9 ? '0' + temporal.getDate() : temporal.getDate()) + '/' + ((temporal.getMonth() + 1) < 9 ? '0' + (temporal.getMonth() + 1) : (temporal.getMonth() + 1)) + '/20' + (temporal.getYear() - 100);
                }
                tmp.fechaVigenciaTenenciaVencida = msj.fechaVigenciaTenenciaVencida;

                tmp.multas = msj.multas;

                res.send(JSON.stringify(tmp));
            }).catch(function(err) {
                dbConn.close();
                // console.log(err);
                regreso('1', err.message, res);
            });
    }).catch(function(err) {
        dbConn.close();
        // console.log(err);
        regreso('2', err.message, res);
    });
});


//APP_CITAS_GET_CONFIGURACION
app.get('/GetConfiguracion', function(req, res) {
    var dbConn = new sql.Connection(config);
    var uss = '0';
    dbConn.connect().then(function() {
        var request = new sql.Request(dbConn);

        request
            .input('idConfiguracion', req.query.idConfiguracion)
            .execute("APP_CITAS_GET_CONFIGURACION").then(function(recordSet) {
                var msj = recordSet[0][0].configuracion;
                var SendObj = { "configuracion": msj };
                var stringData = JSON.stringify(SendObj);

                // Indicamos el tipo de contenido a devolver en las cabeceras de nuestra respuesta
                res.contentType('application/json');
                res.header("Access-Control-Allow-Origin", "*");
                res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");

                res.send(stringData);
            }).catch(function(err) {
                dbConn.close();
                res.contentType('application/json');
                res.header("Access-Control-Allow-Origin", "*");
                res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");

                res.send("Error: " + err.message);
            });
    }).catch(function(err) {
        dbConn.close();
        res.contentType('application/json');
        res.header("Access-Control-Allow-Origin", "*");
        res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");

        res.send("Error: " + err.message);
    });
});

//APP_CITAS_GET_PRMOCION
app.get('/GetPromocion', function(req, res) {
    var dbConn = new sql.Connection(config);
    var uss = '0';
    dbConn.connect().then(function() {
        var request = new sql.Request(dbConn);

        request
            .input('marca', req.query.marca)
            .input('submarca', req.query.submarca)
            .execute("APP_CITAS_GET_PRMOCION").then(function(recordSet) {
                var stringData = JSON.stringify(recordSet[0]);
                // Indicamos el tipo de contenido a devolver en las cabeceras de nuestra respuesta
                res.contentType('application/json');
                res.header("Access-Control-Allow-Origin", "*");
                res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");

                res.send(stringData);
            }).catch(function(err) {
                dbConn.close();
                res.contentType('application/json');
                res.header("Access-Control-Allow-Origin", "*");
                res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");

                res.send("Error: " + err.message);
            });
    }).catch(function(err) {
        dbConn.close();
        res.contentType('application/json');
        res.header("Access-Control-Allow-Origin", "*");
        res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");

        res.send("Error: " + err.message);
    });
});


//APP_CITAS_NUEVA_CITA
app.get('/ServicioNuevaCita', function(req, res) {
    var dbConn = new sql.Connection(config);
    dbConn.connect().then(function() {
        var request = new sql.Request(dbConn);

        request
            .input('idUnidad', req.query.idUnidad)
            .input('idContratoOperacion', req.query.idContratoOperacion)
            .input('idUsuario', req.query.idUsuario)
            .input('idTaller', req.query.idTaller)
            .input('idServicio', req.query.idServicio)
            .input('fechaCita', req.query.fechaCita)
            .execute("APP_CITAS_NUEVA_CITA").then(function(recordSet) {
                var msj = JSON.stringify(recordSet[0]);
                dbConn.close();
                res.contentType('application/json');
                res.header("Access-Control-Allow-Origin", "*");
                res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");

                res.send(msj);
            }).catch(function(err) {
                dbConn.close();
                regreso('0', 'Err1:' + err.message, res);
            });
    }).catch(function(err) {
        dbConn.close();
        regreso('0', 'Err2:' + err.message, res);
    });
});


function Cita() {
    this.idServicio;
    this.Servicio;
    this.imagen;
}

//APP_CITAS_GET_SERVICIOS
app.get('/CitaServicios', function(req, res) {
    var dbConn = new sql.Connection(config);
    dbConn.connect().then(function() {
        var request = new sql.Request(dbConn);
        //console.log(req.query.idUnidad);
        request
            .input('idUnidad', req.query.idUnidad)
            .execute("APP_CITAS_GET_SERVICIOS").then(function(recordSet) {
                var msg = recordSet[0];
                var Citas = [];
                for (var i = 0; i < msg.length; i++) {
                    //	console.log(msg[i]);
                    var _cita = new Cita();
                    _cita.idServicio = msg[i].idServicio;
                    _cita.Servicio = msg[i].Servicio;
                    _cita.imagen = null;
                    if (msg[i].imagen != undefined && msg[i].imagen != null && msg[i].imagen != '') {
                        _cita.imagen = 'http://' + conf.Sisco.host + ':' + conf.DoctosSisco.host + '/partidas/' + msg[i].imagen;
                    }
                    Citas.push(_cita);
                }
                dbConn.close();
                res.contentType('application/json');
                res.header("Access-Control-Allow-Origin", "*");
                res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");

                res.send(JSON.stringify(Citas));
            }).catch(function(err) {
                dbConn.close();
                regreso('0', 'Err1:' + err.message, res);
            });
    }).catch(function(err) {
        dbConn.close();
        regreso('0', 'Err2:' + err.message, res);
    });
});



//APP_CITAS_GET_SERVICIOS
app.get('/CancelaCita', function(req, res) {
    var dbConn = new sql.Connection(config);
    dbConn.connect().then(function() {
        var request = new sql.Request(dbConn);
        //console.log(req.query.idUnidad);
        request
            .input('numeroOrden', req.query.numeroOrden)
            .execute("APP_CITAS_CANCELA_CITA").then(function(recordSet) {
                var msg = recordSet[0][0];
                dbConn.close();
                res.contentType('application/json');
                res.header("Access-Control-Allow-Origin", "*");
                res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
                res.send(JSON.stringify(msg));
            }).catch(function(err) {
                dbConn.close();
                regreso('0', 'Err1:' + err.message, res);
            });
    }).catch(function(err) {
        dbConn.close();
        regreso('0', 'Err2:' + err.message, res);
    });
});

//APP_CITAS_CALIFICAR_TALLER
app.get('/CalificaTaller', function(req, res) {
    var dbConn = new sql.Connection(config);
    dbConn.connect().then(function() {
        var request = new sql.Request(dbConn);
        request
            .input('idOrden', req.query.idOrden)
            .input('calificacion1', req.query.calificacion1)
            .input('calificacion2', req.query.calificacion2)
            .input('calificacion3', req.query.calificacion3)
            .input('calificacion4', req.query.calificacion4)
            .input('calificacion5', req.query.calificacion5)
            .execute("APP_CITAS_CALIFICAR_TALLER").then(function(recordSet) {
                var msj = JSON.stringify(recordSet[0]);
                dbConn.close();
                res.contentType('application/json');
                res.header("Access-Control-Allow-Origin", "*");
                res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
                res.send(msj);
            }).catch(function(err) {
                dbConn.close();
                regreso('0', 'Err1:' + err.message, res);
            });
    }).catch(function(err) {
        dbConn.close();
        regreso('0', 'Err2:' + err.message, res);
    });
});

// APP_CITAS_RECUPERA_PSW

app.get('/RecuperaPsw', function(req, res) {
    var dbConn = new sql.Connection(config);
    dbConn.connect().then(function() {
        var request = new sql.Request(dbConn);
        request
            .input('idUsuario', req.query.idUsuario)
            .input('placas', req.query.placas)
            .execute("APP_CITAS_RECUPERA_PSW").then(function(recordSet) {
                var email = recordSet[0][0].email;
                var psw = recordSet[0][0].psw;
                var SendObj = { "status": "no", "msg": "Ocurrio un error en el envió, intentar más tarde." };
                if (email == 'NO' || email == '') {
                    SendObj = { "status": "no", "msg": "Los datos no concuerdan verificar." };
                } else if (email == '') {
                    SendObj = { "status": "no", "msg": "No hay email registrado." };
                } else {
                    var mail = {
                            "body": "Usted ha intentado recuperar su contraseña en la App. Esta es: " + psw,
                            "email": email,
                        },
                        resp;

                    mailCtrl.sendEmail(mail, resp);
                    SendObj = { "status": "ok", "msg": "La contraseña se envió a: " + email };
                }
                var msj = JSON.stringify(SendObj);
                dbConn.close();
                res.contentType('application/json');
                res.header("Access-Control-Allow-Origin", "*");
                res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
                res.send(msj);
            }).catch(function(err) {
                dbConn.close();
                regreso('0', 'Err1:' + err.message, res);
            });
    }).catch(function(err) {
        dbConn.close();
        regreso('0', 'Err2:' + err.message, res);
    });
});

// APP_CITAS_SET_CONFIRMACION
app.get('/NotificaEvento', function(req, res) {
    var dbConn = new sql.Connection(config);
    var evento = req.query.evento;

    dbConn.connect().then(function() {
        var request = new sql.Request(dbConn);
        request
            .input('idUsuario', req.query.idUsuario)
            .input('idUnidad', req.query.idUnidad)
            .execute("APP_CITAS_ROBOACC").then(function(recordSet) {
                var usr = recordSet[0][0];
                var uni = recordSet[1][0];
                dbConn.close();
                var confServicio = conf.Notificaciones;

                confServicio.path = "/SetNotificacion";
                confServicio.method = "POST";
                var Id_Cat_Notificacion = (evento == "robo") ? "28" : "29";
                var body = {
                    "Id_Cat_App": "1",
                    "Id_Cat_Notificacion": Id_Cat_Notificacion,
                    "Fecha_Limite": usr.date,
                    "Nombre_Receptor": usr.nombreCompleto,
                    "Email": usr.correoElectronico,
                    "IdUnidad": uni.IdUnidad,
                    "No_Economico": uni.numeroEconomico,
                    "Vin": uni.vin,
                    "Id_Contrato_Operacion": uni.idContratoOperacion,
                    "Id_Usuario": usr.idUsuario,
                    "Observaciones": "Reporte de " + evento + " del usuario: " + usr.nombreUsuario + " placas: " + uni.placas
                };
                confServicio.headers = {
                    'Content-Type': 'application/json',
                }

                // Se invoca el servicio RESTful con las opciones configuradas previamente y sin objeto JSON.
                invocarServicio(confServicio, JSON.stringify(body), function(data, err) {
                    if (err) {
                        regreso('0', 'Error al conectar a las alertas: ' + err.message, res);
                    } else {
                        res.contentType('application/json');
                        res.header("Access-Control-Allow-Origin", "*");
                        res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
                        res.send(JSON.stringify({ "ok": data.msj }));
                    }
                });

            }).catch(function(err) {
                dbConn.close();
                console.log(err);
                regreso('0', 'Err1:' + err.message, res);
            });
    }).catch(function(err) {
        dbConn.close();
        console.log(err);
        regreso('0', 'Err2:' + err.message, res);
    });
});

app.get('/MarcaVisto', function(req, res) {

    var postData = querystring.stringify({
        'idDatBitacora': req.query.idNotificacion,
        'fechaVisto': 'getdate',
        'obsVisto': "Visto desede app mi auto"
    });
    var confServicio = conf.Notificaciones;
    confServicio.path = "/get_UpdDat_Bitacora?" + postData;
    confServicio.method = "GET";
    confServicio.headers = {}

    // Se invoca el servicio RESTful con las opciones configuradas previamente y sin objeto JSON.
    invocarServicio(confServicio, null, function(data, err) {
        if (err) {
            regreso('0', 'Error al conectar a las alertas: ' + err.message, res);
        } else {
            res.contentType('application/json');
            res.header("Access-Control-Allow-Origin", "*");
            res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
            if (data)
                res.send(JSON.stringify({ "ok": data.msj }));
            else
                res.send(JSON.stringify({ "ok": "no se recibio respuesta" }));
        }
    });
});

let UPLOAD_PATH = './uploads/';
var nombreFisico = '';
var file_up = null;

// Multer Settings for file upload
var storage = multer.diskStorage({
    destination: function(req, file, cb) {
        file_up = cb;
        cb(null, UPLOAD_PATH)
    },
    filename: function(req, file, cb) {
        var datetimestamp = Date.now();
        nombreFisico = file.fieldname + '-' + datetimestamp + '.' + file.originalname.split('.')[file.originalname.split('.').length - 1];
        cb(null, nombreFisico);
    }
})
let upload = multer({ storage: storage })



//APP_CITAS_CALIFICAR_TALLER
app.post('/Set_Visto', upload.single('image'), (req, res, next) => {
    res.contentType('application/json');
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");

    var dbConn = new sql.Connection(config);
    dbConn.connect().then(function() {
        var request = new sql.Request(dbConn);
        request
            .input('idOrden', req.body.idOrden)
            .input('calificacion1', req.body.calificacion1)
            .input('calificacion2', req.body.calificacion2)
            .input('calificacion3', req.body.calificacion3)
            .input('calificacion4', req.body.calificacion4)
            .input('calificacion5', req.body.calificacion5)
            .execute("APP_CITAS_CALIFICAR_TALLER").then(function(recordSet) {
                var msj = JSON.stringify(recordSet[0]);

                dbConn.close();
                var ruta = 'http://' + Sisco.host + ':' + Sisco.port + Sisco.path;
                var rs = fs.createReadStream(UPLOAD_PATH + nombreFisico);
                var fotmData = {
                    idOrden: req.body.idOrden,
                    docServer: 'evidencia',
                    myFile1: rs
                }

                requestG.post({
                    url: ruta,
                    formData: fotmData

                }, function(err, httpResponse, body) {
                    if (err) {
                        regreso('0', 'err0:' + err.message, res);
                        console.log('err0');
                        console.log(err);
                    } else {
                        var dbConn2 = new sql.Connection(config);
                        dbConn2.connect().then(function() {
                            var request = new sql.Request(dbConn2);
                            request
                                .input('nombreEvidencia', nombreFisico)
                                .input('descripcionEvidencia', 'Evidencia cargada por App Mi Auto')
                                .input('rutaEvidencia', req.body.idOrden + '/evidencia/' + nombreFisico)
                                .input('idOrden', req.body.idOrden)
                                .execute("INS_EVIDENCIAS_ORDEN_SP").then(function(recordSet) {
                                    var msj = JSON.stringify(recordSet[0][0]);
                                    dbConn2.close();
                                    res.send(msj);
                                }).catch(function(err) {
                                    dbConn2.close();
                                    console.log('err1');
                                    console.log(err);
                                    regreso('0', 'err1:' + err.message, res);
                                });
                        });
                    }
                });
            }).catch(function(err) {
                dbConn.close();
                regreso('0', 'Err3:' + err.message, res);
            });
    }).catch(function(err) {
        dbConn.close();
        regreso('0', 'Err4:' + err.message, res);
    });
});



//  =========      Funciones para Mi Taller   =========  

app.get('/LogeaTaller', function(req, res) {
    // console.log(req);
    ValidaLog(req, res, true);
});

//APP_CITAS_GET_ORDENES_SIN_CONF
app.get('/GetCitasPendientes', function(req, res) {
    var dbConn = new sql.Connection(config);
    dbConn.connect().then(function() {
        var request = new sql.Request(dbConn);

        request
            .input('idUsuario', req.query.idUsuario)
            .execute("APP_CITAS_GET_ORDENES_SIN_CONF").then(function(recordSet) {
                var msj = JSON.stringify(recordSet[0]);
                dbConn.close();
                res.contentType('application/json');
                res.header("Access-Control-Allow-Origin", "*");
                res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");

                res.send(msj);
            }).catch(function(err) {
                dbConn.close();
                regreso('0', 'Err1:' + err.message, res);
            });
    }).catch(function(err) {
        dbConn.close();
        regreso('0', 'Err2:' + err.message, res);
    });
});

//APP_CITAS_GET_Mensajes
app.get('/APP_CITAS_GET_Mensajes', function(req, res) {
    var dbConn = new sql.Connection(config);
    dbConn.connect().then(function() {
        var request = new sql.Request(dbConn);

        request
            .input('idOrden', req.query.idOrden)
            .execute("APP_CITAS_GET_Mensajes").then(function(recordSet) {
                var msj = JSON.stringify(recordSet[0]);
                dbConn.close();
                res.contentType('application/json');
                res.header("Access-Control-Allow-Origin", "*");
                res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
                res.send(msj);
            }).catch(function(err) {
                dbConn.close();
                regreso('0', 'Err1:' + err.message, res);
            });
    }).catch(function(err) {
        dbConn.close();
        regreso('0', 'Err2:' + err.message, res);
    });
});

// APP_CITAS_SET_CONFIRMACION
app.get('/UpdateFecha', function(req, res) {
    var dbConn = new sql.Connection(config);
    dbConn.connect().then(function() {
        var request = new sql.Request(dbConn);

        request
            .input('UsuarioTaller', req.query.UsuarioTaller) // 0 = Taller , 1 = usuario
            .input('idOrden', req.query.idOrden)
            .input('Observacion', req.query.Observacion)
            .input('FechaConfir', req.query.FechaConfir)

        .execute("APP_CITAS_SET_CONFIRMACION").then(function(recordSet) {
            var msj = recordSet[0][0];
            dbConn.close();

            /*
            if(msj){
            	var parametros = {
            		"App":3, // Mi taller
            		"VinPlaca":"1"
            	}
            	conf.Notificaciones.path = "/SetNotificacion";
			
            	// Se invoca el servicio RESTful con las opciones configuradas previamente y sin objeto JSON.
            	invocarServicio(conf.Notificaciones, null, function (data, err) {
            		//console.log(data);
            		if (err) { regreso('0','Error al conectar a las alertas: '+err.message,res); } 
            		else { 
            			if(msj){ 
            				msj.mensajes = data;
            				res.send(JSON.stringify(msj));
            			} else
            			{
            				regreso('0','No coinciden el usuario o la contraseña',res);
            			}
            		}
            	});
            }
            */

            res.contentType('application/json');
            res.header("Access-Control-Allow-Origin", "*");
            res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");

            res.send(JSON.stringify(msj));
        }).catch(function(err) {
            dbConn.close();
            regreso('0', 'Err1:' + err.message, res);
        });
    }).catch(function(err) {
        dbConn.close();
        regreso('0', 'Err2:' + err.message, res);
    });
});


// escuchar
app.listen(4800);
console.log("Servidor MiAuto 0.1.5 en el puerto 4800");