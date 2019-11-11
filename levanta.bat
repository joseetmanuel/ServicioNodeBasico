@echo off
@REM initialize test value to be "true"
@SET intCounter=1
:while
@IF %intCounter% GTR 10 (GOTO wend)
@echo Levantando servicio: %intCounter%
Node server.js
@SET /a intCounter=intCounter+1
@GOTO while
:wend
@echo El servicio ha muerto... 
@PAUSE