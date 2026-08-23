[Setup]
AppName=english_word_study
AppVersion=1.0.1
AppPublisher=8048519
SetupIconFile=.\apps\_internal\icon.ico
; 启用自定义安装路径（用户可修改）
DefaultDirName={autopf}\wg\english_word_study
DisableDirPage=no
; 分组
DefaultGroupName=英语单词背诵
; 核心：禁用管理员权限
PrivilegesRequired=lowest
;64位，修改为32位时注释
ArchitecturesInstallIn64BitMode=x64
ArchitecturesAllowed=x64os
; 原有配置保留
OutputBaseFilename=english_word_study
OutputDir=./output
DisableProgramGroupPage=no
DisableReadyPage=no
DisableFinishedPage=no
WizardStyle=modern
MinVersion=6.1sp1
LanguageDetectionMethod=none
Compression=lzma2/ultra64
SolidCompression=yes

[Languages]
Name: "chinesesimplified"; MessagesFile: "compiler:Languages\ChineseSimplified.isl"


[Files]
; 打包build13.0.2文件夹所有内容到安装目录的build13.0.2子文件夹
Source: "apps\*"; DestDir: "{app}\apps"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
; 修复路径格式（使用\而非.\）和图标路径
Name: "{userdesktop}\英语单词背诵"; Filename: "{app}\apps\app.exe"; WorkingDir: "{app}\apps"
Name: "{group}\英语单词背诵"; Filename: "{app}\apps\app.exe"; WorkingDir: "{app}\apps"
Name: "{group}\卸载 英语单词背诵"; Filename: "{uninstallexe}"

[Run]
; 修复启动路径
Filename: "{app}\apps\app.exe"; Description: "启动 英语单词背诵"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
Type: filesandordirs; Name: "{app}"
Type: files; Name: "{userdesktop}\英语单词背诵.lnk"