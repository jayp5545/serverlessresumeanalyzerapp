"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Upload, CircleX, FileUp } from "lucide-react"
import AWS from "aws-sdk"
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

export default function ResumeUploadComponent() {
  const [skills, setSkills] = useState([])
  const [pdfFile, setPdfFile] = useState(null)
  const [newSkill, setNewSkill] = useState("")

  const s3Client = new S3Client({
     region: 'us-east-1',
     credentials: {
        accessKeyId: NEXT_PUBLIC_AWS_ACCESS_KEY_ID,
        secretAccessKey: NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY,
        sessionToken: NEXT_PUBLIC_AWS_SESSION_TOKEN
      },
   });
  const handlePdfChange = (e) =>{
    setPdfFile(e.target.files[0])
  }
  const handleAddSkill = () => {
    if (newSkill.trim() !== "") {
      setSkills([...skills, newSkill.trim()])
      setNewSkill("")
    }
  }
  const handleDeleteSkill = (index) => {
    const updatedSkills = [...skills]
    updatedSkills.splice(index, 1)
    setSkills(updatedSkills)
  }

  const handleSubmit = async (e) => {

    e.preventDefault()
    if (!pdfFile) {
      setMessage('Please upload a PDF file.')
      return
    }
    if (skills.length === 0) {
      setMessage('Please add some skills.')
      return
    }
    const skillsBlob = new Blob([JSON.stringify({ skills })], { type: 'application/json' })
      const formData = new FormData()
      formData.append('resume', pdfFile)
      formData.append('skills', skillsBlob)

      const uploadFile = async (file, key) => {
        const params = {
          Bucket: NEXT_PUBLIC_S3_BUCKET_NAME,  
          Key: key,
          Body: file,
          ContentType: file.type,
        }
        try{
          // return s3.upload(params).promise()
          const command = new PutObjectCommand(params)
          return await s3Client.send(command)
        }catch(err){
          console.log("Errr here in uplaoding in uploadFile"+ err);
        }

      }

      try{
        // console.log("in try")
          const currentDate = Date.now()
          const pdfKey = `${currentDate}-${pdfFile.name}`
          const pdfUpload =  uploadFile(pdfFile, pdfKey)

          const skillsBlob = new Blob([JSON.stringify({ skills })], { type: 'application/json' })
          const skillsKey = `${currentDate}-skills.json`
          const skillsUpload =  uploadFile(skillsBlob, skillsKey)

          await Promise.all([pdfUpload, skillsUpload])
          setMessage('Files uploaded successfully.')
      }catch (error) {
        console.error('Error uploading files:', error)
        setMessage('Error uploading files. Please try again.')
      }
    } 



  return (
    <div className="container mx-auto py-12 px-4 sm:px-6 lg:px-8">
    <div className="">
      <h1 className="text-4xl text-center font-bold">Welcome to Resume Match</h1>
      <h3 className="text-bold text-center">Upload resume and get the results on the inbox</h3>    
    </div>
    <form onSubmit={handleSubmit} className="grid gap-12 mt-10">

      <div className="grid gap-12 mt-10">
        <div>
          <div className="mb-6">
            <h2 className="text-2xl font-bold">Upload PDF</h2>
            <p className="text-muted-foreground">Upload a PDF file to your account.</p>
          </div>
          <div className="flex items-center justify-center bg-muted rounded-lg p-8">
            <div className="flex flex-col align-center justify-center">
             { !pdfFile && ( 
              <div className="flex items-center justify-center">
              <input type="file" id="pdf-upload" accept="application/pdf" 
              className="sr-only" 
              onChange={handlePdfChange} 
              />
              <label
                htmlFor="pdf-upload"
                className="inline-flex items-center justify-center px-4 py-2 border border-primary rounded-md shadow-sm text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
              >
                <Upload className="mr-2 h-5 w-5" />
                Upload PDF
              </label>
              </div>
             )
              }
              <p className="mt-2 text-muted-foreground">Supported file types: PDF</p>
              {pdfFile && (
                <div className="flex items-center justify-center">

                <div className="mt-4 bg-card flex w-3/5 p-4 rounded-md">
                  <div className="flex items-center justify-between">
                      <FileUp  className="mr-2 h-5 w-5" />
                      {pdfFile.name}
                  </div>
                </div>
                  </div>
              )}
            </div>
          </div>
        </div>
        <div>
          <div className="mb-6">
            <h2 className="text-2xl font-bold">Skills</h2>
            <p className="text-muted-foreground">Add the skills you want to match in the resume.</p>
          </div>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Input
                type="text"
                placeholder="Add a new skill"
                value={newSkill}
                onChange={(e) => setNewSkill(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    console.log("in enter")
                    handleAddSkill()
                  }
                }}
              />
              <Button 
              type="button"
              onClick={handleAddSkill}
              >Add</Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {skills.map((skill, index) => (
                <Card key={index} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-lg font-medium">{skill}</div>
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteSkill(index)}>
                      <CircleX  className="h-5 w-5" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>
      <Button className = "w-50"type="submit">Submit</Button>
      </form>
    </div>
  )
}
