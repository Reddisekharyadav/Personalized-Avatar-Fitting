# GLTF to GLB Batch Converter
Write-Host "GLTF to GLB Batch Converter" -ForegroundColor Cyan
Write-Host "===========================" -ForegroundColor Cyan
Write-Host ""

$targetDir = if ($args[0]) { $args[0] } else { Get-Location }

Write-Host "Searching for GLTF files in: $targetDir" -ForegroundColor Yellow
Write-Host ""

$gltfFiles = Get-ChildItem -Path $targetDir -Filter *.gltf -Recurse

if ($gltfFiles.Count -eq 0) {
    Write-Host "No GLTF files found in the specified directory." -ForegroundColor Red
} else {
    $foundCount = 0
    
    foreach ($file in $gltfFiles) {
        $foundCount++
        $inputFile = $file.FullName
        $outputFile = [System.IO.Path]::ChangeExtension($inputFile, "glb")
        
        Write-Host "Found: $inputFile" -ForegroundColor Green
        Write-Host "Converting to: $outputFile" -ForegroundColor Yellow
        
        $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
        $rootDir = Split-Path -Parent $scriptDir
        
        Set-Location $rootDir
        node scripts/convert-gltf-to-glb.js "$inputFile" "$outputFile"
        
        Write-Host ""
    }
    
    Write-Host "Conversion complete! Processed $foundCount files." -ForegroundColor Green
}