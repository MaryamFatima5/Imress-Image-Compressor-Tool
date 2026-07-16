[Setup]
AppName=Imress
AppVersion=1.0
AppPublisher=Imress
DefaultDirName={autopf}\Imress
DefaultGroupName=Imress
OutputDir=installer_output
OutputBaseFilename=Imress_Setup
Compression=lzma
SolidCompression=yes
UninstallDisplayIcon={app}\Imress.exe
ArchitecturesInstallIn64BitMode=x64compatible

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Create a &desktop icon"; GroupDescription: "Additional icons:"

[Files]
Source: "dist\Imress.exe"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\Imress"; Filename: "{app}\Imress.exe"
Name: "{group}\Uninstall Imress"; Filename: "{uninstallexe}"
Name: "{autodesktop}\Imress"; Filename: "{app}\Imress.exe"; Tasks: desktopicon

[Run]
Filename: "{app}\Imress.exe"; Description: "Launch Imress"; Flags: nowait postinstall skipifsilent