using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Data;
using System.Drawing;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows.Forms;
using OpenTK;
using OpenTK.Graphics.OpenGL;
using OpenTK.Input;
using System.IO;

namespace RayTracing
{
    public partial class Form1 : Form
    {
        int BasicProgramID; // Номер дескриптора на графической карте
        int BasicVertexShader; // Адрес вершинного шейдера  
        int BasicFragmentShader; // Адрес фрагментного шейдера

        int vbo_position; // хранение дескриптора объекта массива вершин
        int attribute_vpos; // передаётся из приложения в вершинный шейдер
        int attribute_rotate; // Адрес параметраб задающего движение сферы
        int attribute_cub_color; // Адрес параметраб задающего цвет куба
        int attribute_sphere1_color; // Адрес параметраб задающего цвет большой сферы
        int attribute_sphere2_color; // Адрес параметраб задающего цвет маленькой сферы

        float angle = 0; // Угол
        Vector3 Rotate; // Задаёт движение сферы
        Vector3 CubColor = new Vector3(1.1f, 1.0f, 0.1f);     // Задает цвет куба
        Vector3 Sphere1Color = new Vector3(1.1f, 1.0f, 0.1f); // Задает цвет большой сферы
        Vector3 Sphere2Color = new Vector3(1.1f, 1.0f, 0.1f); // Задает цвет маленькой сфера

        void loadShader(String filename, ShaderType type, int program, out int address)
        {
            address = GL.CreateShader(type); // создаёт объект шейдера
            using (StreamReader sr = new StreamReader(filename))
            {
                GL.ShaderSource(address, sr.ReadToEnd());
                // загружает исходный код в созданный шейдерный объект
            }
            GL.CompileShader(address); // компилирование шейдера
            GL.AttachShader(program, address); // компоновка в шейдерную программу
            Console.WriteLine(GL.GetShaderInfoLog(address)); // 
        }

        private void InitShaders()
        {
            string glVersion = GL.GetString(StringName.Version);
            string glslVersion = GL.GetString(StringName.ShadingLanguageVersion);
            // создание объекта программы
            BasicProgramID = GL.CreateProgram();
            loadShader("..\\..\\Shaders\\raytracing.vert", ShaderType.VertexShader, BasicProgramID,
            out BasicVertexShader);
            loadShader("..\\..\\Shaders\\raytracing.frag", ShaderType.FragmentShader, BasicProgramID,
            out BasicFragmentShader);
            //Компановка программы
            GL.LinkProgram(BasicProgramID);
            // Проверить успех компановки
            int status = 0;
            GL.GetProgram(BasicProgramID, GetProgramParameterName.LinkStatus, out status);
            Console.WriteLine(GL.GetProgramInfoLog(BasicProgramID));

            attribute_vpos = GL.GetAttribLocation(BasicProgramID, "vPosition");
            attribute_rotate = GL.GetUniformLocation(BasicProgramID, "Rotate");
            attribute_cub_color = GL.GetUniformLocation(BasicProgramID, "CubColor"); 
            attribute_sphere1_color = GL.GetUniformLocation(BasicProgramID, "Sphere1Color"); 
            attribute_sphere2_color = GL.GetUniformLocation(BasicProgramID, "Sphere2Color"); 

            Vector3[] vertdata = new Vector3[] // массив вершин
            {
                            new Vector3(-1f, -1f, 0f),
                            new Vector3( 1f, -1f, 0f),
                            new Vector3( 1f, 1f, 0f),
                            new Vector3(-1f, 1f, 0f)
            };

            GL.GenBuffers(1, out vbo_position);
            GL.BindBuffer(BufferTarget.ArrayBuffer, vbo_position);
            GL.BufferData(BufferTarget.ArrayBuffer, (IntPtr)(vertdata.Length * Vector3.SizeInBytes),
                                   vertdata, BufferUsageHint.StaticDraw);
            GL.VertexAttribPointer(attribute_vpos, 3, VertexAttribPointerType.Float, false, 0, 0);

            GL.UseProgram(BasicProgramID);

            GL.BindBuffer(BufferTarget.ArrayBuffer, 0);

            GL.Uniform3(attribute_rotate, Rotate);
            GL.Uniform3(attribute_cub_color, CubColor);
            GL.Uniform3(attribute_sphere1_color, Sphere1Color);
            GL.Uniform3(attribute_sphere2_color, Sphere2Color);
        }

        private void Draw()
        {
            GL.Viewport(0, 0, glControl1.Width, glControl1.Height);
            GL.Clear(ClearBufferMask.ColorBufferBit | ClearBufferMask.DepthBufferBit);
            GL.Enable(EnableCap.DepthTest);
            angle += 0.2f;
            Rotate = new Vector3(-2 + (float)Math.Cos(angle), -1, -1 + (float)Math.Cos(angle));

            GL.EnableVertexAttribArray(attribute_vpos);
            GL.DrawArrays(PrimitiveType.Quads, 0, 4);
            GL.DisableVertexAttribArray(attribute_vpos);


            glControl1.SwapBuffers();

            GL.UseProgram(0);
        }

        private void glControl1_Paint(object sender, PaintEventArgs e)
        {
            InitShaders();
            Draw();
        }

        public Form1()
        {
            InitializeComponent();
            glControl1.Invalidate();
        }
        private void Form1_Load(object sender, EventArgs e)
        {
            Application.Idle += Application_Idle;
        }
        private void Application_Idle(Object sender, EventArgs e)
        {
            while (glControl1.IsIdle)
            {
                glControl1.Invalidate();
                System.Threading.Thread.Sleep(50);
            }
        }

        private void textBox8_TextChanged(object sender, EventArgs e)
        {

        }

        private void textBox7_TextChanged(object sender, EventArgs e)
        {

        }

        private void textBox9_TextChanged(object sender, EventArgs e)
        {

        }

        private void button1_Click(object sender, EventArgs e)
        {
            double A = Clamp(Convert.ToDouble(textBox1.Text), 0.0, 1.0); 
            double B = Clamp(Convert.ToDouble(textBox2.Text), 0.0, 1.0);
            double C = Clamp(Convert.ToDouble(textBox3.Text), 0.0, 1.0);
            CubColor.X = (float)A;
            CubColor.Y = (float)B;
            CubColor.Z = (float)C;
        }

        private void button2_Click(object sender, EventArgs e)
        {
            double A = Clamp(Convert.ToDouble(textBox6.Text), 0.0, 1.0);
            double B = Clamp(Convert.ToDouble(textBox5.Text), 0.0, 1.0);
            double C = Clamp(Convert.ToDouble(textBox4.Text), 0.0, 1.0);
            Sphere1Color.X = (float)A;
            Sphere1Color.Y = (float)B;
            Sphere1Color.Z = (float)C;
        }

        public double Clamp(double value, double min, double max)
        {
            return (value < min) ? min : (value > max) ? max : value;
        }

        private void button3_Click_1(object sender, EventArgs e)
        {
            double A = Clamp(Convert.ToDouble(textBox9.Text), 0.0, 1.0);
            double B = Clamp(Convert.ToDouble(textBox8.Text), 0.0, 1.0);
            double C = Clamp(Convert.ToDouble(textBox7.Text), 0.0, 1.0);
            Sphere2Color.X = (float)A;
            Sphere2Color.Y = (float)B;
            Sphere2Color.Z = (float)C;
        }
    }
}
