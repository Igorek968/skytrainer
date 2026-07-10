@echo off
:: Add tvoytrener.rf -> 127.0.0.1 (run as Administrator: right-click -> Run as administrator)
set HOSTS=%SystemRoot%\System32\drivers\etc\hosts
findstr /C:"xn--b1agaovdpdkd.xn--p1ai" "%HOSTS%" >nul 2>&1
if %errorlevel%==0 (
  echo Hosts already configured.
  goto :done
)
echo.>>"%HOSTS%"
echo # skytrainer tvoytrener.rf>>"%HOSTS%"
echo 127.0.0.1 xn--b1agaovdpdkd.xn--p1ai>>"%HOSTS%"
echo 127.0.0.1 www.xn--b1agaovdpdkd.xn--p1ai>>"%HOSTS%"
echo Added tvoytrener.rf -^> 127.0.0.1
:done
echo Open: http://xn--b1agaovdpdkd.xn--p1ai
pause
