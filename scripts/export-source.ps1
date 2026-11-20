$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$exportPath = Join-Path $projectRoot 'artifacts/restaurant-v1-release-candidate.zip'
if (Test-Path -LiteralPath $exportPath) { throw 'Source export already exists; choose a new output name.' }
$selected = @('src','public','docs','tests','test','scripts','lib','server','assets','supabase/migrations','supabase/functions','supabase/config.toml','supabase/seed.sql','package.json','package-lock.json','next.config.ts','next-env.d.ts','tsconfig.json','postcss.config.mjs','eslint.config.mjs','README.md','.env.example','.prettierrc.json')
$selected += Get-ChildItem -LiteralPath $projectRoot -File | Where-Object { $_.Extension -in @('.html','.js','.css') } | Select-Object -ExpandProperty Name
$selected += @('.gitignore','.github/workflows/verify.yml')
New-Item -ItemType Directory -Path (Join-Path $projectRoot 'artifacts') -Force | Out-Null
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [System.IO.Compression.ZipFile]::Open($exportPath, [System.IO.Compression.ZipArchiveMode]::Create)
$count = 0
try {
 foreach ($relative in $selected) {
  $entry = Get-Item -LiteralPath (Join-Path $projectRoot $relative)
  $files = if ($entry.PSIsContainer) { Get-ChildItem -LiteralPath $entry.FullName -Recurse -File } else { @($entry) }
  foreach ($file in $files) {
   $resolved = $file.FullName
   if (-not $resolved.StartsWith($projectRoot + [IO.Path]::DirectorySeparatorChar)) { throw 'Export source escaped project.' }
   $archiveName = [IO.Path]::GetRelativePath($projectRoot, $resolved).Replace('\','/')
   [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive,$resolved,$archiveName,[System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
   $count++
  }
 }
} finally { $archive.Dispose() }
Write-Output "Exported $count source files to $exportPath"
