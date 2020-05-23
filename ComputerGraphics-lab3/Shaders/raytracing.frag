#version 430

/* Фрагментный шейдер вызывается для каждого 
графического элемента (т.е. пикселя растрового 
изображения, попадающего на экран). 
Выходом фрагментного шейдера является цвет пикселя, 
который идёт в буфер цвета. Также в фрагментном 
шейдере выполняется вся основная часть расчёта освещения. */

#define EPSILON  0.001
#define BIG  1000000.0 // верхнее ограничение для расстояния

const int DIFFUSE = 1;
const int MIRROR_REFLECTION = 2;

// Входные переменные
in vec3 glPosition; // позиция вершины
// Выходные переменные
out vec4 FragColor; // итоговый цвет пикселя

uniform vec3 Rotate;

uniform vec3 CubColor;
uniform vec3 Sphere1Color;
uniform vec3 Sphere2Color;

struct SCamera // камера
{
	// отношение сторон выходного изображения
	vec3 Position, View, Up, Side;
	// масштаб
	vec2 Scale;
};

struct SLight // источник света
{
	vec3 Position; // позиция вершины луча
};

struct SRay // луч
{
	vec3 Origin; // начало луча
	vec3 Direction; // направление луча
};

struct SIntersection // пересечение
{
	float Time; // время (на самом деле расстояние:)
	vec3 Point; // точка пересечения
	vec3 Normal; // нормаль
	vec3 Color; // цвет

	vec4 LightCoeffs;

	float ReflectionCoef; 
	float RefractionCoef;
	int MaterialType;
};

struct SSphere // сфера
{
	 vec3 Center; // центр
	 float Radius; // радиус
	 int MaterialIdx; // материал
};

struct STriangle // треугольник
{
	vec3 v1, v2, v3; // вершины треугольника
	int MaterialIdx; // материал
};

struct SKub	// куб
{
	vec3 v1, v2, v3;
	int MaterialIdx;
};

struct SMaterial // материал
{
	//diffuse color
	vec3 Color;
	// ambient, diffuse and specular coeffs
	vec4 LightCoeffs;
	// 0 - non-reflection, 1 - mirror
	float ReflectionCoef;
	float RefractionCoef;
	int MaterialType;
};

struct STracingRay 
{ 
	SRay ray;
	float contribution;
	int depth;
};

// Стек
vec3[1000] array;
int size = 0;
vec3 popRay() { return array[--size]; }
void pushRay(vec3 ray) { array[size++] = ray; }
bool isEmpty() { return size < 1; }

// Глобальные переменные
SSphere spheres[2]; // массив сфер
SKub kubs[12];
STriangle triangles[12]; // массив треугольников
SLight uLight; // источник освещения
SMaterial materials[9]; // массив материалов
int raytraceDepth = 10; // глубина следа луча

//------------------------------------------------------------------------
//      ГЕНЕРАЦИЯ ПЕРВИЧНОГО ЛУЧА
//------------------------------------------------------------------------

SRay GenerateRay (SCamera uCamera) // генерация луча по параметрам положения камеры
{
	vec2 coords = glPosition.xy * uCamera.Scale;
	vec3 direction = uCamera.View + uCamera.Side * coords.x + uCamera.Up * coords.y;
	return SRay (uCamera.Position, normalize(direction));
}

SCamera initializeDefaultCamera() // инициализация параметров камеры
{
	SCamera camera;
	camera.Position = vec3(0.0, 0.0, -4.00);
	camera.View = vec3(0.0, 0.0, 1.0);
	camera.Up = vec3(0.0, 1.0, 0.0);
	camera.Side = vec3(1.0, 0.0, 0.0);
	camera.Scale = vec2(1.0);
	return camera;
}

//------------------------------------------------------------------------
//      ДОБАВЛЕНИЕ СТРУКТУР ДАННЫХ СЦЕНЫ И ИСТОЧНИКОВ СВЕТА
//------------------------------------------------------------------------

void initializeDefaultScene( out STriangle triangles[12],  out SSphere spheres[2])
{
	/** TRIANGLES **/
	
	/* left wall */
	triangles[0].v1 = vec3(-5.0,-5.0,-5.0);
	triangles[0].v2 = vec3(-5.0, 5.0, 5.0);
	triangles[0].v3 = vec3(-5.0, 5.0,-5.0);
	triangles[0].MaterialIdx = 0;
	triangles[1].v1 = vec3(-5.0,-5.0,-5.0);
	triangles[1].v2 = vec3(-5.0,-5.0, 5.0);
	triangles[1].v3 = vec3(-5.0, 5.0, 5.0);
	triangles[1].MaterialIdx = 0;
	
	/* back wall */
	triangles[2].v1 = vec3(-5.0,-5.0, 5.0);
	triangles[2].v2 = vec3( 5.0,-5.0, 5.0);
	triangles[2].v3 = vec3(-5.0, 5.0, 5.0);
	triangles[2].MaterialIdx = 1;
	triangles[3].v1 = vec3( 5.0, 5.0, 5.0);
	triangles[3].v2 = vec3(-5.0, 5.0, 5.0);
	triangles[3].v3 = vec3( 5.0,-5.0, 5.0);
	triangles[3].MaterialIdx = 1;
	
	/*right wall */
	triangles[4].v1 = vec3(5.0, 5.0, 5.0);
	triangles[4].v2 = vec3(5.0, -5.0, 5.0);
	triangles[4].v3 = vec3(5.0, 5.0, -5.0);
	triangles[4].MaterialIdx = 2;
	triangles[5].v1 = vec3(5.0, 5.0, -5.0);
	triangles[5].v2 = vec3(5.0, -5.0, 5.0);
	triangles[5].v3 = vec3(5.0, -5.0, -5.0);
	triangles[5].MaterialIdx = 2;
	
	/*down wall */
	triangles[6].v1 = vec3(-5.0,-5.0, 5.0);
	triangles[6].v2 = vec3(-5.0,-5.0,-5.0);
	triangles[6].v3 = vec3( 5.0,-5.0, 5.0);
	triangles[6].MaterialIdx = 3;
	triangles[7].v1 = vec3(5.0, -5.0, -5.0);
	triangles[7].v2 = vec3(5.0,-5.0, 5.0);
	triangles[7].v3 = vec3(-5.0,-5.0,-5.0);
	triangles[7].MaterialIdx = 3;
	
	/*up wall */
	triangles[8].v1 = vec3(-5.0, 5.0,-5.0);
	triangles[8].v2 = vec3(-5.0, 5.0, 5.0);
	triangles[8].v3 = vec3( 5.0, 5.0, 5.0);
	triangles[8].MaterialIdx = 4;
	triangles[9].v1 = vec3(-5.0, 5.0, -5.0);
	triangles[9].v2 = vec3( 5.0, 5.0, 5.0);
	triangles[9].v3 = vec3(5.0, 5.0, -5.0);
	triangles[9].MaterialIdx = 4;

	/*front wall*/
	triangles[10].v1 = vec3(-5.0,-5.0, -5.0);
	triangles[10].v2 = vec3( 5.0,-5.0, -5.0);
	triangles[10].v3 = vec3(-5.0, 5.0, -5.0);
	triangles[10].MaterialIdx = 5;
	triangles[11].v1 = vec3( 5.0, 5.0, -5.0);
	triangles[11].v2 = vec3(-5.0, 5.0, -5.0);
	triangles[11].v3 = vec3( 5.0,-5.0, -5.0);
	triangles[11].MaterialIdx = 5;
	
	/** SPHERES **/
	//spheres[0].Center = vec3(-1.0,-1.0,-1.0);
	spheres[0].Center = Rotate;
	spheres[0].Radius =  1.0;
	spheres[0].MaterialIdx = 6;
	
	spheres[1].Center = vec3(1.5,1.0,2.0);
	spheres[1].Radius = 1.0;
	spheres[1].MaterialIdx = 7;

	/** KUBS **/
	kubs[0].v1 = vec3(0.25,-1.29,0.0);	//a (вершины)
	kubs[0].v2 = vec3(0.71, -1.97, 0.82);	//h
	kubs[0].v3 = vec3(0.25, -1.29,0.82);	//e
	kubs[0].MaterialIdx = 8;

	kubs[1].v1 = vec3(0.25,-1.29,0.0);	//a
	kubs[1].v2 = vec3( 0.03, -2.43, 0.0);	//c
	kubs[1].v3 = vec3(0.71, -1.97, 0.0);	//d
	kubs[1].MaterialIdx = 8;

	kubs[2].v1 = vec3( 0.03, -2.43, 0.0);	//c
	kubs[2].v2 = vec3(0.71, -1.97, 0.0);	//d
	kubs[2].v3 = vec3(0.71, -1.97, 0.82);	//h
	kubs[2].MaterialIdx = 8;

	kubs[3].v1 = vec3( 0.03, -2.43, 0.82);	//g
	kubs[3].v2 = vec3(0.71, -1.97, 0.82);	//h
	kubs[3].v3 = vec3( 0.03, -2.43, 0.0);	//c
	kubs[3].MaterialIdx = 8;

	kubs[4].v1 = vec3( 0.03, -2.43, 0.82);	//g
	kubs[4].v2 = vec3( 0.03, -2.43, 0.0);	//c
	kubs[4].v3 = vec3(-0.43,-1.75,0.82);	//f
	kubs[4].MaterialIdx = 8; 

	kubs[5].v1 = vec3(-0.43,-1.75,0.82);	//f
	kubs[5].v2 = vec3( 0.03, -2.43, 0.0);	//c
	kubs[5].v3 = vec3(-0.43, -1.75, 0.0); //b
	kubs[5].MaterialIdx = 8; 

	kubs[6].v1 = vec3( 0.03, -2.43, 0.0); //c
	kubs[6].v2 = vec3(0.25,-1.29,0.0); //a
	kubs[6].v3 = vec3(-0.43, -1.75, 0.0); //b
	kubs[6].MaterialIdx = 8; 

	kubs[7].v1 = vec3(0.71, -1.97, 0.82); //h
	kubs[7].v2 = vec3(0.71, -1.97, 0.0);	//d
	kubs[7].v3 = vec3(0.25,-1.29,0.0);	//a
	kubs[7].MaterialIdx = 8; 

	kubs[8].v1 = vec3(0.25, -1.29,0.82); //e
	kubs[8].v2 = vec3(0.71, -1.97, 0.82); //h
	kubs[8].v3 = vec3( 0.03, -2.43, 0.82); //g
	kubs[8].MaterialIdx = 8; 

	kubs[9].v1 = vec3(0.25, -1.29,0.82); //e
	kubs[9].v2 = vec3( 0.03, -2.43, 0.82);	//g
	kubs[9].v3 = vec3(-0.43,-1.75,0.82);;	//f
	kubs[9].MaterialIdx = 8; 

	kubs[10].v1 = vec3(0.25,-1.29,0.0); //a
	kubs[10].v2 = vec3(-0.43, -1.75, 0.0); //b
	kubs[10].v3 = vec3(0.25,-1.29,0.82); //e
	kubs[10].MaterialIdx = 8; 

	kubs[11].v1 = vec3(-0.43,-1.75,0.82); //f
	kubs[11].v2 = vec3(0.25,-1.29,0.82); //e
	kubs[11].v3 = vec3(-0.43, -1.75, 0.0); //b
	kubs[11].MaterialIdx = 8;
}

//------------------------------------------------------------------------
//					ПЕРЕСЕЧЕНИЕ ЛУЧА С ОБЪЕКТАМИ
//------------------------------------------------------------------------

// пересечение луча со сферой
bool IntersectSphere (SSphere sphere, SRay ray, float start, float final, out float time)
{
	ray.Origin -= sphere.Center;
	float A = dot ( ray.Direction, ray.Direction );
	float B = dot ( ray.Direction, ray.Origin );
	float C = dot ( ray.Origin, ray.Origin ) - sphere.Radius * sphere.Radius;
	float D = B * B - A * C;
	if ( D > 0 )
	{
		D = sqrt(D);
		//time = min(max(0, ( -B - D ) / A ), ( -B + D ) / A );
		float t1 = ( -B - D ) / A;
		float t2 = ( -B + D ) / A;
		if((t1 < 0) && (t2 < 0))
			return false;

		if(min(t1, t2) < 0)
		{
			time = max(t1,t2);
			return true;
		}
		time = min(t1, t2);
		return true;
	}
	return false;
}

bool IntersectTriangle (SRay ray, vec3 v1, vec3 v2, vec3 v3, out float time )
{
	time = -1.0;
	vec3 A = v2 - v1;
	vec3 B = v3 - v1;
	vec3 N = cross(A, B);
	float NdotRayDirection = dot(N, ray.Direction);
	if (abs(NdotRayDirection) < 0.001)
		return false;
	float d = dot(N, v1);

	float t = -(dot(N, ray.Origin) - d) / NdotRayDirection;

	if (t < 0)
		return false;

	vec3 P = ray.Origin + t * ray.Direction;

	vec3 C;

	vec3 edge1 = v2 - v1;
	vec3 VP1 = P - v1;
	C = cross(edge1, VP1);
	if (dot(N, C) < 0)
		return false;

	vec3 edge2 = v3 - v2;
	vec3 VP2 = P - v2;
	C = cross(edge2, VP2);
	if (dot(N, C) < 0)
		return false;

	vec3 edge3 = v1 - v3;
	vec3 VP3 = P - v3;
	C = cross(edge3, VP3);
	if (dot(N, C) < 0)
		return false;

	time = t;
	return true;
}

// Трассировка луча. Функция пересекает луч со всеми примитивами сцены
bool Raytrace ( SRay ray, float start, float final, inout SIntersection intersect )
{
	bool result = false;
	float test = start;
	intersect.Time = final;
	for(int i = 0; i < 2; i++)
	{
		SSphere sphere = spheres[i];
		if(IntersectSphere(sphere, ray, start, final, test) && (test < intersect.Time) )
		{
			intersect.Time = test;
			intersect.Point = ray.Origin + ray.Direction * test;
			intersect.Normal = normalize ( intersect.Point - spheres[i].Center );
			intersect.Color = materials[sphere.MaterialIdx].Color;
			intersect.LightCoeffs = materials[sphere.MaterialIdx].LightCoeffs;
			intersect.ReflectionCoef = materials[sphere.MaterialIdx].ReflectionCoef;
			intersect.RefractionCoef = materials[sphere.MaterialIdx].RefractionCoef;
			intersect.MaterialType = materials[sphere.MaterialIdx].MaterialType;
			result = true;
		}
	}
	for(int i = 0; i < 12; i++)
	{
		STriangle triangle = triangles[i];
		if((IntersectTriangle(ray, triangle.v1, triangle.v2, triangle.v3, test)) && (test < intersect.Time))
		{ 
			intersect.Time = test;
			intersect.Point = ray.Origin + ray.Direction * test;
			intersect.Normal = normalize(cross(triangle.v1 - triangle.v2, triangle.v3 - triangle.v2));
			intersect.Color = materials[triangle.MaterialIdx].Color;
			intersect.LightCoeffs = materials[triangle.MaterialIdx].LightCoeffs;
			intersect.ReflectionCoef = materials[triangle.MaterialIdx].ReflectionCoef;
			intersect.RefractionCoef = materials[triangle.MaterialIdx].RefractionCoef;
			intersect.MaterialType = materials[triangle.MaterialIdx].MaterialType;
			result = true;
		}
	}
	
	//calculate intersect with kubs
	for(int i = 0; i < 12; i++)
	{
		SKub kub = kubs[i];
		if(IntersectTriangle(ray, kub.v1, kub.v2, kub.v3, test)&& (test < intersect.Time))
		{			
			intersect.Time = test;
			intersect.Point = ray.Origin + ray.Direction * test;
			intersect.Normal = normalize(cross(kub.v1 - kub.v2, kub.v3 - kub.v2));
			intersect.Color = materials[kub.MaterialIdx].Color;
			intersect.LightCoeffs = materials[kub.MaterialIdx].LightCoeffs;
			intersect.ReflectionCoef = materials[kub.MaterialIdx].ReflectionCoef;
			intersect.RefractionCoef = materials[kub.MaterialIdx].RefractionCoef;
			intersect.MaterialType = materials[kub.MaterialIdx].MaterialType;
			result = true;
		}
	}

	return result;
}

/*Light */
void initializeDefaultLightMaterials(out SLight light, out SMaterial materials[9])
{
	//** LIGHT **//
	light.Position = vec3(0.0, 2.00, -4.0);
	/** MATERIALS **/
	vec4 lightCoefs = vec4(0.4,0.9,0.0,512.0);
	materials[0].Color = vec3(1.0, 1.0, 1.0);
	materials[0].LightCoeffs = vec4(lightCoefs);
	materials[0].ReflectionCoef = 0.5;
	materials[0].RefractionCoef = 1.0;
	materials[0].MaterialType = DIFFUSE;
	
	materials[1].Color = vec3(1.0, 1.0, 1.0);
	materials[1].LightCoeffs = vec4(lightCoefs);
	materials[1].ReflectionCoef = 0.5;
	materials[1].RefractionCoef = 1.0;
	//materials[1].MaterialType = DIFFUSE;
	materials[1].MaterialType = MIRROR_REFLECTION; // нижняя стенка прозрачная

	materials[2].Color = vec3(1.0, 0.0, 0.0);
	materials[2].LightCoeffs = vec4(lightCoefs);
	materials[2].ReflectionCoef = 0.5;
	materials[2].RefractionCoef = 1.0;
	materials[2].MaterialType = DIFFUSE;
	
	materials[3].Color = vec3(0.0, 0.0, 0.0);
	materials[3].LightCoeffs = vec4(lightCoefs);
	materials[3].ReflectionCoef = 0.5;
	materials[3].RefractionCoef = 1.0;
	materials[3].MaterialType = DIFFUSE;
	
	materials[4].Color = vec3(0.0, 0.0, 107);
	materials[4].LightCoeffs = vec4(lightCoefs);
	materials[4].ReflectionCoef = 0.5;
	materials[4].RefractionCoef = 1.0;
	materials[4].MaterialType = DIFFUSE;
	
	materials[5].Color = vec3(0, 1.0, 1.0);
	materials[5].LightCoeffs = vec4(lightCoefs);
	materials[5].ReflectionCoef = 0.5;
	materials[5].RefractionCoef = 1.0;
	materials[5].MaterialType = DIFFUSE;
	
	materials[6].Color = Sphere2Color;
	materials[6].LightCoeffs = vec4(lightCoefs);
	materials[6].ReflectionCoef = 0.5;
	materials[6].RefractionCoef = 1.0;
	materials[6].MaterialType = MIRROR_REFLECTION;
	
	materials[7].Color = Sphere1Color;
	materials[7].LightCoeffs = vec4(lightCoefs);
	materials[7].ReflectionCoef = 0.5;
	materials[7].RefractionCoef = 1.0;
	materials[7].MaterialType = MIRROR_REFLECTION;

	materials[8].Color =  CubColor;	//материал для куба
	materials[8].LightCoeffs = vec4(lightCoefs);
	materials[8].ReflectionCoef = 0.5;
	materials[8].RefractionCoef = 1.3;	
	materials[8].MaterialType = DIFFUSE;

}

//------------------------------------------------------------------------
//					ОСВЕЩЕНИЕ
//------------------------------------------------------------------------

// расчёт освещения по модели Фонга
vec3 Phong ( SCamera uCamera, SIntersection intersect, SLight currLight, float shadowing)
{
	vec3 light = normalize ( currLight.Position - intersect.Point );
	float diffuse = max(dot(light, intersect.Normal), 0.0);
	vec3 view = normalize(uCamera.Position - intersect.Point);
	vec3 reflected = reflect( -view, intersect.Normal );
	float specular = pow(max(dot(reflected, light), 0.0), intersect.LightCoeffs.w);
	int Unit = 1;
	return intersect.LightCoeffs.x * intersect.Color + intersect.LightCoeffs.y * diffuse * intersect.Color * shadowing  + intersect.LightCoeffs.z * specular * Unit;
}

// высчитывание теней на сцене
/* Чтобы «нарисовать» падающие тени необходимо выпустить, так называемые теневые
лучи. Из каждой точки, для которой рассчитываем освещение выпускается луч на
источник света, если этот луч пересекает какую-нибудь ещё геометрию сцены, значит
точка в тени и она освещена только ambient компонентой */
float Shadow(SLight currLight, SIntersection intersect)
{
	float shadowing = 1.0;
	vec3 direction = normalize(currLight.Position - intersect.Point);
	float distanceLight = distance(currLight.Position, intersect.Point);
	SRay shadowRay = SRay(intersect.Point + direction * EPSILON, direction);
	SIntersection shadowIntersect;
	shadowIntersect.Time = BIG;
	if(Raytrace(shadowRay, 0.0, distanceLight, shadowIntersect))
	{
		shadowing = 0.0;
	}
	return shadowing;
}

void main ( void )
{ 
	float start = 0;
	float final = BIG;
	
	SCamera uCamera = initializeDefaultCamera();
	initializeDefaultLightMaterials(uLight, materials);
	SRay ray = GenerateRay(uCamera);
	SIntersection intersect;
	intersect.Time = BIG;
	vec3 resultColor = vec3(0,0,0);
	initializeDefaultScene(triangles, spheres);
	STracingRay trRay = STracingRay(ray, 1.0, 0);
	
	float contribution = 1;
	int count = 0;
	while(count < raytraceDepth)
	{
		ray = trRay.ray;
		SIntersection intersect;
		intersect.Time = BIG;
        count++;
		
        if (Raytrace(ray, start, final, intersect))
		{
			if (intersect.MaterialType == DIFFUSE)
			{
				float shadowing = Shadow(uLight, intersect);
				resultColor += trRay.contribution * Phong (uCamera, intersect, uLight, shadowing);
				count = raytraceDepth;
			}
			else
			{
				contribution = trRay.contribution * (1 - intersect.ReflectionCoef);
				float shadowing = Shadow(uLight, intersect);
                		pushRay(Phong(uCamera, intersect, uLight, shadowing)* (1 - intersect.ReflectionCoef));
				vec3 reflectDirection = reflect(ray.Direction, intersect.Normal);
				
				// creare reflection ray
				contribution = trRay.contribution * intersect.ReflectionCoef;
				STracingRay reflectRay = STracingRay( SRay(intersect.Point + reflectDirection * EPSILON, reflectDirection), contribution, trRay.depth + 1);
				trRay = reflectRay;
			}
		}
	}
	contribution = 1;
	while(!isEmpty())
	{
        resultColor += contribution * popRay();
		contribution = contribution*0.5;
	}
	FragColor = vec4 (resultColor, 1.0);
}