FROM python:3.10

WORKDIR /app

COPY . /app

RUN pip install --upgrade pip
RUN pip install tensorflow==2.13.0 mediapipe==0.10.13 protobuf==4.21.12

CMD ["python", "services/ml/worker.py"]
