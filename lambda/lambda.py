import json
import boto3
import time
import re
import os

sns_topic_arn = os.environ['SNS_TOPIC_ARN']

def lambda_handler(event, context):
    s3 = boto3.client('s3')
    sns = boto3.client('sns')

    bucket_name = event['Records'][0]['s3']['bucket']['name']
    key = event['Records'][0]['s3']['object']['key']
    prefix_match = re.match(r'(\d+)-', key)
    if not prefix_match:
        print("No valid prefix found in key:", key)
        return
    
    prefix = prefix_match.group(1)

    if key.endswith('.pdf'):
        resume_key = key
        json_key = f"{prefix}-skills.json"
        print(json_key)
    elif key.endswith('.json'):
        json_key = key
        resume_key = f"{prefix}-resume.pdf"
        print(resume_key)
    else:
        return {
            'statusCode': 400,
            'body': json.dumps({'error': 'Unsupported file type'})
        }
    
    try:
        start_time = time.time()
        while True:
            resume_exists = json_exists = False
            try:
                s3.head_object(Bucket=bucket_name, Key=resume_key)
                resume_exists = True
            except s3.exceptions.ClientError:
                pass
            
            try:
                s3.head_object(Bucket=bucket_name, Key=json_key)
                json_exists = True
            except s3.exceptions.ClientError:
                pass

            if resume_exists and json_exists:
                break 
            elif time.time() - start_time > 300:  
                return {
                    'statusCode': 400,
                    'body': json.dumps({'error': 'Corresponding file not found'})
                }
            time.sleep(10)  

        
        skills_response = s3.get_object(Bucket=bucket_name, Key=json_key)
        skills_content = skills_response['Body'].read().decode('utf-8')
        data = json.loads(skills_content)
        desired_skills = data.get('skills', [])        
        
        textract = boto3.client('textract', region_name='us-east-1')  

        
        response = textract.start_document_analysis(
            DocumentLocation={'S3Object': {'Bucket': bucket_name, 'Name': resume_key}},
            FeatureTypes=["TABLES", "FORMS"]
        )

        job_id = response['JobId']
        print(f'Started job with ID: {job_id}')

      
        job_status = None
        while job_status not in ['SUCCEEDED', 'FAILED']:
            time.sleep(5)
            job_status = get_document_analysis_status(textract, job_id)
            print(f'Job status: {job_status}')

        if job_status == 'SUCCEEDED':
        
            result = get_document_analysis_results(textract, job_id)
            
            
            full_text = ' '.join([block['Text'] for block in result['Blocks'] if block['BlockType'] == 'LINE'])
            print(f'Detected Text: {full_text}')

          
            extracted_skills = extract_skills(full_text, desired_skills)
            matched_skills = match_skills(extracted_skills, desired_skills)

          
            response = {
                'matched_skills': matched_skills,
                'number_of_matches': len(matched_skills)
            }
            print(response)


            sns_response = sns.publish(
                TopicArn=sns_topic_arn,
                Message=json.dumps(response),
                Subject='Resume Processing Results'
            )
            
            return {
                'statusCode': 200,
                'body': json.dumps(response)
            }
            
        else:
            return {
                'statusCode': 500,
                'body': json.dumps({'error': 'Document analysis failed'})
            }
    except Exception as e:
        print(f'Error: {str(e)}')
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }

def get_document_analysis_status(textract, job_id):
    response = textract.get_document_analysis(JobId=job_id)
    return response['JobStatus']

def get_document_analysis_results(textract, job_id):
    response = textract.get_document_analysis(JobId=job_id)
    return response

def extract_skills(text, desired_skills):
    skills = []
    for skill in desired_skills:
        if skill.lower() in text.lower():
            skills.append(skill)
    return skills

def match_skills(extracted_skills, desired_skills):
    matched_skills = [skill for skill in extracted_skills if skill in desired_skills]
    return matched_skills