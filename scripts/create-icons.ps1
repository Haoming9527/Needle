$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$iconDirectory = Join-Path $PSScriptRoot '..\public\icons'
[System.IO.Directory]::CreateDirectory($iconDirectory) | Out-Null
foreach ($size in @(48,128)) {
  $bitmap = [System.Drawing.Bitmap]::new($size, $size)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.Clear([System.Drawing.Color]::FromArgb(36,89,236))
  $pen = [System.Drawing.Pen]::new([System.Drawing.Color]::White, [single]($size * 0.07))
  $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $graphics.DrawLine($pen, [single]($size*.3), [single]($size*.72), [single]($size*.66), [single]($size*.25))
  $graphics.DrawEllipse($pen, [single]($size*.49), [single]($size*.21), [single]($size*.23), [single]($size*.23))
  $bitmap.Save((Join-Path $iconDirectory "needle-$size.png"), [System.Drawing.Imaging.ImageFormat]::Png)
  $pen.Dispose()
  $graphics.Dispose()
  $bitmap.Dispose()
}
