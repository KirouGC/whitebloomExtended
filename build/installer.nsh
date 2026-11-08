; Extra NSIS pages for the Whitebloom installer (picked up automatically by electron-builder).
; Adds the welcome page so the installer opens on the Whitebloom sidebar artwork.
!macro customWelcomePage
  !insertmacro MUI_PAGE_WELCOME
!macroend
