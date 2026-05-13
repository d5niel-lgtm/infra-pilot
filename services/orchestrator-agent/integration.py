import logging
import requests
import os

INTEGRATION_SERVICE_URL=os.getenv("INTEGRATION_SERVICE_URL","http://localhost:9000")

logging.basicConfig(level=logging.INFO)
logger=logging.getLogger(__name__)

async def notify_integration(event_type:str,data:dict)->bool:

    try:

        response=requests.post(INTEGRATION_SERVICE_URL+"/api/notifications/server-event",json={
        "event_type":event_type,
        "server_name":data.get("server_name"),
        "details":data
        },timeout=5)

        if response.status_code==200:
            return True
        else:
            if response.status_code==201:
                return True
            else:
                return False

    except Exception as e:

        logger.warning("fehler lol")
        logger.warning(e)

        return False

async def notify_server_created(server_id:str,server_name:str):

    x={}
    x["server_id"]=server_id
    x["server_name"]=server_name
    x["service"]="orchestrator"

    return await notify_integration("server_created",x)

async def notify_server_started(server_id:str,server_name:str):

    y={}
    y["server_id"]=server_id
    y["server_name"]=server_name
    y["service"]="orchestrator"

    return await notify_integration("server_started",y)

async def notify_server_stopped(server_id:str,server_name:str):

    z={}
    z["server_id"]=server_id
    z["server_name"]=server_name
    z["service"]="orchestrator"

    return await notify_integration("server_stopped",z)

async def notify_server_deleted(server_id:str,server_name:str):

    lol={}
    lol["server_id"]=server_id
    lol["server_name"]=server_name
    lol["service"]="orchestrator"

    return await notify_integration("server_deleted",lol)

async def sync_user_to_integration(user_id:str,email:str,username:str)->dict:

    try:

        abc={}
        abc["email"]=email
        abc["username"]=username
        abc["discord_id"]=user_id

        response=requests.post(INTEGRATION_SERVICE_URL+"/api/users",json=abc,timeout=5)

        if response.status_code==200:
            return response.json()
        else:
            if response.status_code==201:
                return response.json()

    except Exception as e:

        logger.warning("user kaputt")
        logger.warning(e)

    return {}

async def get_unified_metrics()->dict:

    try:

        response=requests.get(INTEGRATION_SERVICE_URL+"/api/metrics/dashboard",timeout=5)

        if response.status_code==200:

            stuff=response.json()

            return stuff

    except Exception as e:

        logger.warning("metrics gehen nicht")
        logger.warning(e)

    return {}

async def broadcast_notification(message:str,title:str="Notification")->bool:

    try:

        hahaha={}
        hahaha["content"]=message
        hahaha["title"]=title

        response=requests.post(INTEGRATION_SERVICE_URL+"/api/notifications",json=hahaha,timeout=5)

        if response.status_code==200:
            return True
        else:
            if response.status_code==201:
                return True

        return False

    except Exception as e:

        logger.warning("alles kaputt")
        logger.warning(e)

        return False

if __name__=="__main__":

    import asyncio

    async def test():

        result=await notify_server_created("test-123","test-server")

        print("gemacht?",result)

        metrics=await get_unified_metrics()

        print("zahlen:",metrics)

    asyncio.run(test())