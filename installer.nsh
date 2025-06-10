!macro customHeader
  !system "echo '' > ${BUILD_RESOURCES_DIR}/customHeader"
!macroend

!macro preInit
  ; Check if Python is installed
  ReadRegStr $0 HKLM "SOFTWARE\Python\PythonCore\3.8\InstallPath" ""
  ${If} $0 == ""
    ReadRegStr $0 HKLM "SOFTWARE\Python\PythonCore\3.9\InstallPath" ""
  ${EndIf}
  ${If} $0 == ""
    ReadRegStr $0 HKLM "SOFTWARE\Python\PythonCore\3.10\InstallPath" ""
  ${EndIf}
  ${If} $0 == ""
    ReadRegStr $0 HKLM "SOFTWARE\Python\PythonCore\3.11\InstallPath" ""
  ${EndIf}
  
  ${If} $0 == ""
    MessageBox MB_YESNO "Python 3.8 or higher is not detected on your system. The application includes an embedded Python runtime, but system Python is recommended for better performance. Do you want to continue?" IDYES continue
    Abort
    continue:
  ${EndIf}
!macroend

!macro customInstall
  ; Create a batch file for easy command-line access
  FileOpen $0 "$INSTDIR\inventory-processor-cli.bat" w
  FileWrite $0 "@echo off$\r$\n"
  FileWrite $0 "cd /d $\"$INSTDIR$\"$\r$\n"
  FileWrite $0 "$\"$INSTDIR\resources\python-embed\python.exe$\" %*$\r$\n"
  FileClose $0
  
  ; Install Python packages if needed
  DetailPrint "Checking Python dependencies..."
  ExecWait '"$INSTDIR\resources\python-embed\python.exe" -m pip install --upgrade pip'
  ExecWait '"$INSTDIR\resources\python-embed\python.exe" -m pip install pandas numpy scikit-learn statsmodels matplotlib openpyxl'
!macroend

!macro customUnInstall
  Delete "$INSTDIR\inventory-processor-cli.bat"
!macroend