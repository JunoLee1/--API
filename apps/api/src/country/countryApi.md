GET https://restcountries.com/v3.1/all <외부>

GET country/:code<단일 국가 조회>
request ={ 
    params: {
        code
    }
    
}
//RESPONSE 
"data":{
    code,
    name,
    region
}


나라 코드가 존재 하지 않는 경우 NOT FOUND. 


GET country <전체 국가 조회>
request ={ 
query:{
        "name"?: string
        "region"?: {
            asia|
            south amercia|
            north amercia|
            EU|
            africa
        }
    }
}
//RESPONSE 
"data":{
    code,
    name,
    region
}[]

[] 리턴
